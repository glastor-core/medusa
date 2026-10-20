/**
 * GLASTOR® Medusa - Configuration Engine
 * Zero-Trust, resilient environment loader for Deno Deploy and local development.
 */

export interface MedusaConfig {
  readonly env: "development" | "production" | "test";
  readonly port: number;
  readonly apilayerApiKey: string;
  readonly medusaApiKey: string | null;
  readonly apilayerBaseUrl: string;
  readonly circuitBreaker: {
    readonly failureThreshold: number;
    readonly resetTimeoutMs: number;
    readonly halfOpenMaxProbes: number;
  };
  readonly rateLimiter: {
    readonly maxRequests: number;
    readonly windowSeconds: number;
  };
  readonly cache: {
    readonly defaultTtlSeconds: number;
    readonly staleGraceSeconds: number;
  };
}

export function loadConfig(): MedusaConfig {
  const env =
    (Deno.env.get("DENO_DEPLOYMENT_ID")
      ? "production"
      : (Deno.env.get("ENV") || "development")) as MedusaConfig["env"];
  const port = parseInt(Deno.env.get("PORT") || "8000", 10);
  const apilayerApiKey = Deno.env.get("APILAYER_API_KEY") || "";
  const medusaApiKey = Deno.env.get("MEDUSA_API_KEY") || null;
  const apilayerBaseUrl = Deno.env.get("APILAYER_BASE_URL") || "https://api.apilayer.com";

  const failureThreshold = parseInt(Deno.env.get("CIRCUIT_BREAKER_FAILURE_THRESHOLD") || "5", 10);
  const resetTimeoutMs = parseInt(Deno.env.get("CIRCUIT_BREAKER_RESET_TIMEOUT_MS") || "30000", 10);
  const halfOpenMaxProbes = parseInt(Deno.env.get("CIRCUIT_BREAKER_HALF_OPEN_PROBES") || "3", 10);

  const maxRequests = parseInt(Deno.env.get("RATE_LIMIT_MAX_REQUESTS") || "60", 10);
  const windowSeconds = parseInt(Deno.env.get("RATE_LIMIT_WINDOW_SECONDS") || "60", 10);

  const defaultTtlSeconds = parseInt(Deno.env.get("CACHE_DEFAULT_TTL_SECONDS") || "300", 10);
  const staleGraceSeconds = parseInt(Deno.env.get("STALE_WHILE_REVALIDATE_SECONDS") || "3600", 10);

  return {
    env,
    port,
    apilayerApiKey,
    medusaApiKey,
    apilayerBaseUrl,
    circuitBreaker: {
      failureThreshold,
      resetTimeoutMs,
      halfOpenMaxProbes,
    },
    rateLimiter: {
      maxRequests,
      windowSeconds,
    },
    cache: {
      defaultTtlSeconds,
      staleGraceSeconds,
    },
  };
}

export const config = loadConfig();
