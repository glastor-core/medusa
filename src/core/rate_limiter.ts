/**
 * GLASTOR® Medusa - Edge Distributed Rate Limiter
 * Utilizes Deno KV globally distributed atomic operations with micro-retries and memory fallback.
 */

import { logger } from "./logger.ts";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export class RateLimiter {
  private kv: Deno.Kv | null = null;
  private memoryStore = new Map<string, { count: number; expiresAt: number }>();
  private defaultMaxRequests: number;
  private defaultWindowSeconds: number;

  constructor(maxRequests = 60, windowSeconds = 60) {
    this.defaultMaxRequests = maxRequests;
    this.defaultWindowSeconds = windowSeconds;
  }

  async init(): Promise<void> {
    try {
      if (typeof Deno.openKv === "function") {
        this.kv = await Deno.openKv();
      }
    } catch (err) {
      logger.warn("[Glastor-RateLimiter] Deno KV unavailable, using memory store", {}, err);
      this.kv = null;
    }
  }

  isKvAvailable(): boolean {
    return this.kv !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.kv) return false;
    try {
      await this.kv.get(["glastor", "health_ping"]);
      return true;
    } catch {
      return false;
    }
  }

  async check(
    identifier: string,
    maxRequests = this.defaultMaxRequests,
    windowSeconds = this.defaultWindowSeconds,
  ): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = Math.floor(now / windowSeconds);
    const resetSeconds = (windowKey + 1) * windowSeconds - now;

    if (this.kv) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const key = ["glastor", "ratelimit", identifier, windowKey];
          const res = await this.kv.get<number>(key);
          const currentCount = res.value ?? 0;

          if (currentCount >= maxRequests) {
            return {
              allowed: false,
              limit: maxRequests,
              remaining: 0,
              resetSeconds,
            };
          }

          // Atomic commit or increment with optimistic check
          const atomic = this.kv.atomic();
          atomic.check(res);
          atomic.set(key, currentCount + 1, { expireIn: windowSeconds * 1000 });
          const commitRes = await atomic.commit();

          if (commitRes.ok) {
            return {
              allowed: true,
              limit: maxRequests,
              remaining: Math.max(0, maxRequests - (currentCount + 1)),
              resetSeconds,
            };
          }

          // If commit conflict occurred, micro-jitter and retry
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 3 + 1));
          }
        } catch (err) {
          logger.warn(
            "[Glastor-RateLimiter] KV transaction failed, falling back to memory",
            {},
            err,
          );
          break;
        }
      }
    }

    // In-memory fallback
    const memKey = `${identifier}:${windowKey}`;
    const entry = this.memoryStore.get(memKey);

    if (!entry || entry.expiresAt <= now) {
      this.memoryStore.set(memKey, { count: 1, expiresAt: now + resetSeconds });
      this.cleanupMemory(now);
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetSeconds,
      };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetSeconds,
      };
    }

    entry.count++;
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - entry.count,
      resetSeconds,
    };
  }

  private cleanupMemory(now: number): void {
    if (this.memoryStore.size > 1000) {
      for (const [k, v] of this.memoryStore.entries()) {
        if (v.expiresAt <= now) {
          this.memoryStore.delete(k);
        }
      }
    }
  }

  applyHeaders(headers: Headers, result: RateLimitResult): void {
    headers.set("RateLimit-Limit", result.limit.toString());
    headers.set("RateLimit-Remaining", result.remaining.toString());
    headers.set("RateLimit-Reset", result.resetSeconds.toString());
    if (!result.allowed) {
      headers.set("Retry-After", result.resetSeconds.toString());
    }
  }
}

export const rateLimiter = new RateLimiter();
