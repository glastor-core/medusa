/**
 * GLASTOR® Medusa - Resilient Multi-Tier Edge Cache
 * Features Deno KV L2 persistence, in-memory L1 acceleration, and Stale-While-Revalidate fallback.
 */

export interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  ttlSeconds: number;
  contentType?: string;
}

export type CacheStatus = "HIT" | "STALE" | "MISS";

export interface CacheLookupResult<T = unknown> {
  status: CacheStatus;
  entry: CacheEntry<T> | null;
  ageSeconds: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  stales: number;
  writes: number;
}

export class EdgeCache {
  private kv: Deno.Kv | null = null;
  private memoryL1 = new Map<string, CacheEntry>();
  private defaultTtlSeconds: number;
  private staleGraceSeconds: number;
  private metrics: CacheMetrics = { hits: 0, misses: 0, stales: 0, writes: 0 };

  constructor(defaultTtlSeconds = 300, staleGraceSeconds = 3600) {
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.staleGraceSeconds = staleGraceSeconds;
  }

  async init(): Promise<void> {
    try {
      if (typeof Deno.openKv === "function") {
        this.kv = await Deno.openKv();
      }
    } catch (err) {
      console.warn("[Glastor-Cache] Deno KV unavailable, running memory L1 only:", err);
      this.kv = null;
    }
  }

  generateKey(
    service: string,
    params: Record<string, string | number | boolean | undefined>,
  ): string {
    const sortedEntries = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== "")
      .sort(([a], [b]) => a.localeCompare(b));
    const paramStr = sortedEntries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join(
      "&",
    );
    return `${service}:${paramStr}`;
  }

  async get<T = unknown>(key: string): Promise<CacheLookupResult<T>> {
    const now = Date.now();

    // 1. Check Memory L1
    const memEntry = this.memoryL1.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      return this.evaluateEntry(memEntry, now);
    }

    // 2. Check Deno KV L2
    if (this.kv) {
      try {
        const kvRes = await this.kv.get<CacheEntry<T>>(["glastor", "cache", key]);
        if (kvRes.value) {
          // Promote to L1
          this.memoryL1.set(key, kvRes.value as CacheEntry);
          return this.evaluateEntry(kvRes.value, now);
        }
      } catch (err) {
        console.warn(`[Glastor-Cache] Failed to read key '${key}' from Deno KV:`, err);
      }
    }

    this.metrics.misses++;
    return { status: "MISS", entry: null, ageSeconds: 0 };
  }

  private evaluateEntry<T>(entry: CacheEntry<T>, now: number): CacheLookupResult<T> {
    const ageSeconds = Math.floor((now - entry.cachedAt) / 1000);
    const isFresh = ageSeconds < entry.ttlSeconds;
    const isStale = ageSeconds < (entry.ttlSeconds + this.staleGraceSeconds);

    if (isFresh) {
      this.metrics.hits++;
      return { status: "HIT", entry, ageSeconds };
    }

    if (isStale) {
      this.metrics.stales++;
      return { status: "STALE", entry, ageSeconds };
    }

    this.metrics.misses++;
    return { status: "MISS", entry: null, ageSeconds };
  }

  async set<T = unknown>(
    key: string,
    data: T,
    ttlSeconds = this.defaultTtlSeconds,
    contentType = "application/json",
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      ttlSeconds,
      contentType,
    };

    // Set Memory L1
    this.memoryL1.set(key, entry as CacheEntry);
    this.metrics.writes++;

    // Set Deno KV L2 with TTL + Grace window
    if (this.kv) {
      try {
        const totalExpireMs = (ttlSeconds + this.staleGraceSeconds) * 1000;
        await this.kv.set(["glastor", "cache", key], entry, { expireIn: totalExpireMs });
      } catch (err) {
        console.warn(`[Glastor-Cache] Failed writing key '${key}' to Deno KV:`, err);
      }
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }
}

export const edgeCache = new EdgeCache();
