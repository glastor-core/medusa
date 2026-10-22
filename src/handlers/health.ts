/**
 * GLASTOR® Medusa - Health, Telemetry & OpenAPI Contract Handler
 * Exposes edge observability metrics, cloud orchestration probes (livez/readyz), and self-describing system status.
 */

import { circuitBreakerRegistry } from "../core/circuit_breaker.ts";
import { edgeCache } from "../core/cache.ts";
import { config } from "../config.ts";
import { singleFlight } from "../core/single_flight.ts";
import { prewarmEngine } from "../core/prewarm.ts";
import { edgeCompressor } from "../core/compression.ts";

const processStartTime = Date.now();

/**
 * Kubernetes & Cloud Orchestrator Liveness Probe (/livez).
 * Always returns 200 OK while the event loop and process are alive.
 * Never returns 503 on upstream failures to prevent cascading container restart loops.
 */
export function handleLiveness(_req: Request, _url: URL, requestId: string): Response {
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);
  const payload = {
    status: "UP",
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    runtime: "Deno",
    requestId,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-glastor-request-id": requestId,
      "x-glastor-status": "UP",
    },
  });
}

/**
 * Kubernetes & Cloud Orchestrator Readiness Probe (/readyz).
 * Evaluates whether the gateway is ready to receive client traffic.
 * Returns 503 if critical dependencies or circuit breakers are open.
 */
export function handleReadiness(_req: Request, _url: URL, requestId: string): Response {
  const breakersMetrics = Array.from(circuitBreakerRegistry.values()).map((cb) => cb.getMetrics());
  const hasOpenBreaker = breakersMetrics.some((b) => b.state === "OPEN");
  const ready = !hasOpenBreaker;
  const status = ready ? "READY" : "DEGRADED";

  const payload = {
    status,
    ready,
    timestamp: new Date().toISOString(),
    openCircuits: breakersMetrics.filter((b) => b.state === "OPEN").map((b) => b.name),
    requestId,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: ready ? 200 : 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-glastor-request-id": requestId,
      "x-glastor-status": status,
    },
  });
}

/**
 * Comprehensive Gateway Health & Telemetry Endpoint (/health).
 */
export function handleHealth(_req: Request, _url: URL, requestId: string): Response {
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);
  const memory = Deno.memoryUsage ? Deno.memoryUsage() : null;

  const breakersMetrics = Array.from(circuitBreakerRegistry.values()).map((cb) => cb.getMetrics());
  const hasOpenBreaker = breakersMetrics.some((b) => b.state === "OPEN");
  const cacheMetrics = edgeCache.getMetrics();
  const flightMetrics = singleFlight.getMetrics();
  const prewarmMetrics = prewarmEngine.getMetrics();
  const compressionMetrics = edgeCompressor.getMetrics();

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
    compression: compressionMetrics,
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

/**
 * Self-describing OpenAPI 3.1 Contract (/openapi.json).
 */
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
    components: {
      securitySchemes: {
        MedusaApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-medusa-key",
          description: "Perimeter gateway access key",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Alternative standard Authorization Bearer header",
        },
      },
      schemas: {
        GlastorError4R: {
          type: "object",
          required: ["success", "error"],
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              required: ["code", "message", "reason", "recovery", "remediation", "requestId"],
              properties: {
                code: { type: "string", example: "GLASTOR_SCHEMA_VALIDATION_FAILED" },
                message: { type: "string", example: "Invalid input parameters" },
                reason: { type: "string", example: "Field 'from' must be 3 characters" },
                recovery: { type: "string", example: "Rejected at perimeter" },
                remediation: { type: "string", example: "Provide a valid ISO currency code" },
                requestId: { type: "string", example: "3da56128-df5c-4df3-87be-39f6b59a6483" },
              },
            },
          },
        },
      },
    },
    paths: {
      "/livez": {
        get: {
          summary: "Orchestrator Liveness Probe",
          description: "Returns 200 OK while the event loop and Deno runtime process are alive.",
          responses: {
            "200": { description: "Process is running" },
          },
        },
      },
      "/readyz": {
        get: {
          summary: "Orchestrator Readiness Probe",
          description:
            "Returns 200 OK when ready to serve traffic, or 503 if circuit breakers are OPEN.",
          responses: {
            "200": { description: "Gateway is ready" },
            "503": { description: "One or more circuit breakers are OPEN" },
          },
        },
      },
      "/health": {
        get: {
          summary: "Gateway health and comprehensive telemetry",
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
              schema: { type: "string", example: "100" },
            },
          ],
          responses: {
            "200": { description: "Conversion calculated or retrieved from edge cache" },
            "400": {
              description: "Validation failure",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/GlastorError4R" } },
              },
            },
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
          responses: {
            "200": { description: "Exchange rates retrieved" },
            "400": {
              description: "Validation failure",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/GlastorError4R" } },
              },
            },
          },
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
          responses: {
            "200": { description: "IP geolocation data retrieved" },
          },
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
          responses: {
            "200": { description: "Email verification results" },
            "400": {
              description: "Validation failure",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/GlastorError4R" } },
              },
            },
          },
        },
      },
      "/v1/proxy/{path}": {
        get: {
          summary: "Universal resilient proxy to any APILayer endpoint",
          parameters: [
            {
              name: "path",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "APILayer response cached or fresh" },
            "502": { description: "Upstream APILayer error" },
          },
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
