/**
 * GLASTOR® Medusa - Health, Telemetry & OpenAPI Contract Handler
 * Exposes edge observability metrics and self-describing system status.
 */

import { circuitBreakerRegistry } from "../core/circuit_breaker.ts";
import { edgeCache } from "../core/cache.ts";
import { config } from "../config.ts";
import { singleFlight } from "../core/single_flight.ts";
import { prewarmEngine } from "../core/prewarm.ts";

const processStartTime = Date.now();

export function handleHealth(_req: Request, _url: URL, requestId: string): Response {
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);
  const memory = Deno.memoryUsage ? Deno.memoryUsage() : null;

  const breakersMetrics = Array.from(circuitBreakerRegistry.values()).map((cb) => cb.getMetrics());
  const hasOpenBreaker = breakersMetrics.some((b) => b.state === "OPEN");
  const cacheMetrics = edgeCache.getMetrics();
  const flightMetrics = singleFlight.getMetrics();
  const prewarmMetrics = prewarmEngine.getMetrics();

  const status = hasOpenBreaker ? "DEGRADED" : "HEALTHY";

  const payload = {
    glastor: "Medusa Resilient Gateway",
    version: "0.1.0",
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    runtime: {
      deno: Deno.version.deno,
      v8: Deno.version.v8,
      typescript: Deno.version.typescript,
      isDenoDeploy: Boolean(Deno.env.get("DENO_DEPLOYMENT_ID")),
    },
    circuitBreakers: breakersMetrics,
    cache: cacheMetrics,
    singleFlight: flightMetrics,
    prewarm: prewarmMetrics,
    memory,
    config: {
      rateLimitWindowSeconds: config.rateLimiter.windowSeconds,
      rateLimitMaxRequests: config.rateLimiter.maxRequests,
      circuitBreakerFailureThreshold: config.circuitBreaker.failureThreshold,
      cacheDefaultTtlSeconds: config.cache.defaultTtlSeconds,
    },
    requestId,
  };

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "x-glastor-request-id": requestId,
    "x-glastor-status": status,
  });

  return new Response(JSON.stringify(payload, null, 2), {
    status: status === "HEALTHY" ? 200 : 503,
    headers,
  });
}

export function handleOpenApi(url: URL, requestId: string): Response {
  const host = url.origin;
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "GLASTOR® Medusa - Edge APILayer Gateway",
      version: "0.1.0",
      description:
        "Resilient edge caching proxy, rate limiter, and circuit breaker for APILayer services on Deno Deploy.",
      contact: {
        name: "GLASTOR® Core Team",
        url: "https://github.com/glastor-core",
      },
      license: {
        name: "Apache 2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0",
      },
    },
    servers: [
      { url: host, description: "Active Edge Deployment" },
    ],
    paths: {
      "/health": {
        get: {
          summary: "Gateway health and telemetry",
          responses: {
            "200": { description: "Gateway is fully operational" },
            "503": { description: "One or more circuit breakers are OPEN" },
          },
        },
      },
      "/v1/currency/convert": {
        get: {
          summary: "Convert currencies with 10-minute resilient caching",
          parameters: [
            {
              name: "from",
              in: "query",
              required: true,
              schema: { type: "string", example: "USD" },
            },
            { name: "to", in: "query", required: true, schema: { type: "string", example: "EUR" } },
            {
              name: "amount",
              in: "query",
              required: false,
              schema: { type: "number", example: 100 },
            },
          ],
          responses: {
            "200": { description: "Conversion calculated or retrieved from edge cache" },
            "429": { description: "Rate limit exceeded" },
            "503": { description: "Circuit breaker OPEN" },
          },
        },
      },
      "/v1/currency/latest": {
        get: {
          summary: "Latest live exchange rates with 15-minute resilient caching",
          parameters: [
            {
              name: "base",
              in: "query",
              required: false,
              schema: { type: "string", example: "USD" },
            },
            {
              name: "symbols",
              in: "query",
              required: false,
              schema: { type: "string", example: "EUR,GBP,JPY" },
            },
          ],
        },
      },
      "/v1/ip-geo/lookup": {
        get: {
          summary: "IP geolocation lookup with 24-hour resilient caching",
          parameters: [
            {
              name: "ip",
              in: "query",
              required: false,
              schema: { type: "string", example: "8.8.8.8" },
            },
          ],
        },
      },
      "/v1/email-verify/check": {
        get: {
          summary: "Email syntax, MX and deliverability check",
          parameters: [
            {
              name: "email",
              in: "query",
              required: true,
              schema: { type: "string", example: "test@domain.com" },
            },
          ],
        },
      },
      "/v1/proxy/{path}": {
        get: {
          summary: "Universal resilient proxy to any APILayer endpoint",
        },
      },
    },
  };

  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-glastor-request-id": requestId,
    },
  });
}
