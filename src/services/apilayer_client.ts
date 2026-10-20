/**
 * GLASTOR® Medusa - APILayer Resilient Client
 * Ingress client integrating Circuit Breakers, Multi-tier Caching, and Exponential Backoff.
 */

import { config } from "../config.ts";
import { edgeCache } from "../core/cache.ts";
import { getCircuitBreaker } from "../core/circuit_breaker.ts";
import { GlastorError } from "../core/errors.ts";
import { singleFlight } from "../core/single_flight.ts";

export interface APILayerRequestOptions {
  service: string;
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  ttlSeconds?: number;
  skipCache?: boolean;
  timeoutMs?: number;
  requestId?: string;
}

export interface APILayerResponse<T = unknown> {
  data: T;
  cacheStatus: "HIT" | "STALE" | "MISS";
  ageSeconds: number;
  latencyMs: number;
  singleFlightShared?: boolean;
}

export class APILayerClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.apilayerBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.apilayerApiKey;
  }

  async request<T = unknown>(options: APILayerRequestOptions): Promise<APILayerResponse<T>> {
    const startTime = performance.now();
    const service = options.service;
    const breaker = getCircuitBreaker(service, {
      failureThreshold: config.circuitBreaker.failureThreshold,
      resetTimeoutMs: config.circuitBreaker.resetTimeoutMs,
      halfOpenMaxProbes: config.circuitBreaker.halfOpenMaxProbes,
    });

    const cacheKey = edgeCache.generateKey(service, {
      path: options.path,
      ...(options.params || {}),
    });

    // 1. Check Edge Cache
    let staleEntry: unknown = null;
    let staleAge = 0;
    if (!options.skipCache && (!options.method || options.method === "GET")) {
      const cached = await edgeCache.get<T>(cacheKey);
      if (cached.status === "HIT" && cached.entry) {
        return {
          data: cached.entry.data,
          cacheStatus: "HIT",
          ageSeconds: cached.ageSeconds,
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
      if (cached.status === "STALE" && cached.entry) {
        staleEntry = cached.entry.data;
        staleAge = cached.ageSeconds;
      }
    }

    // 2. Validate API Key before remote call
    if (!this.apiKey) {
      if (staleEntry) {
        return {
          data: staleEntry as T,
          cacheStatus: "STALE",
          ageSeconds: staleAge,
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
      throw new GlastorError({
        code: "GLASTOR_MISSING_UPSTREAM_KEY",
        statusCode: 500,
        message: "APILayer API Key is not configured on this Gateway",
        reason: "The environment variable 'APILAYER_API_KEY' is empty or not set.",
        recovery: "Please configure APILAYER_API_KEY in Deno Deploy or in your local .env file.",
        remediation:
          "Visit https://apilayer.com/ to generate an API key and inject it into Deno Deploy environment.",
        requestId: options.requestId,
      });
    }

    // 3. Fallback definition for Circuit Breaker
    const fallback = staleEntry
      ? (): Promise<T> => {
        console.warn(
          `[Glastor-Client][${service}] Upstream call failed. Returning STALE cache fallback.`,
        );
        return Promise.resolve(staleEntry as T);
      }
      : undefined;

    // 4. Execute via Single-Flight & Circuit Breaker with Retry
    try {
      const flightResult = await singleFlight.do(cacheKey, async () => {
        return await breaker.execute(async () => {
          return await this.fetchWithRetry<T>(options);
        }, fallback);
      });

      const data = flightResult.data;
      const shared = flightResult.shared;
      const latencyMs = Math.round(performance.now() - startTime);

      // Save to cache if fresh fetch (and we were the leader of the flight)
      if (
        !options.skipCache && (!options.method || options.method === "GET") &&
        data !== staleEntry && !shared
      ) {
        const ttl = options.ttlSeconds ?? config.cache.defaultTtlSeconds;
        await edgeCache.set(cacheKey, data, ttl);
      }

      return {
        data,
        cacheStatus: data === staleEntry ? "STALE" : "MISS",
        ageSeconds: data === staleEntry ? staleAge : 0,
        latencyMs,
        singleFlightShared: shared,
      };
    } catch (err) {
      if (staleEntry) {
        return {
          data: staleEntry as T,
          cacheStatus: "STALE",
          ageSeconds: staleAge,
          latencyMs: Math.round(performance.now() - startTime),
        };
      }

      if (err instanceof GlastorError) {
        throw err;
      }

      const metrics = breaker.getMetrics();
      if (metrics.state === "OPEN") {
        throw GlastorError.circuitOpen(service, metrics.resetTimeoutRemainingMs, options.requestId);
      }

      throw GlastorError.upstreamError(
        service,
        502,
        err instanceof Error ? err.message : String(err),
        false,
        options.requestId,
      );
    }
  }

  private async fetchWithRetry<T>(options: APILayerRequestOptions, maxRetries = 2): Promise<T> {
    const query = new URLSearchParams();
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== "") {
          query.set(k, String(v));
        }
      }
    }

    const cleanPath = options.path.startsWith("/") ? options.path : `/${options.path}`;
    const queryString = query.toString();
    const url = `${this.baseUrl}${cleanPath}${queryString ? `?${queryString}` : ""}`;

    const headers = new Headers(options.headers);
    headers.set("apikey", this.apiKey);
    headers.set("User-Agent", "Glastor-Medusa-Gateway/0.1.0 (Deno Deploy)");

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);

      try {
        const res = await fetch(url, {
          method: options.method || "GET",
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text().catch(() => "Unknown upstream error");
          // Non-retryable client errors (400, 401, 403, 404)
          if (res.status >= 400 && res.status < 500) {
            throw new GlastorError({
              code: `GLASTOR_APILAYER_${res.status}`,
              statusCode: res.status,
              message: `APILayer rejected request with HTTP ${res.status}`,
              reason: errorText,
              recovery: "Upstream error returned directly to client.",
              remediation: "Verify parameters, quotas, and subscription on apilayer.com.",
              requestId: options.requestId,
            });
          }
          // Server errors (5xx) are retryable
          throw new Error(`Upstream APILayer HTTP ${res.status}: ${errorText}`);
        }

        const json = await res.json() as T;
        return json;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;

        // If it's a GlastorError (4xx), do not retry
        if (err instanceof GlastorError) {
          throw err;
        }

        // Retry with backoff if attempts remaining
        if (attempt < maxRetries) {
          const jitter = Math.random() * 200;
          const delay = Math.pow(2, attempt) * 300 + jitter;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export const apilayerClient = new APILayerClient();
