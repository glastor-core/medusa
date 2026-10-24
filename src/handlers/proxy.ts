/**
 * GLASTOR® Medusa - Universal APILayer Resilient Proxy Handler
 * Proxies any APILayer endpoint through Medusa with edge caching and circuit breakers.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { GlastorError } from "../core/errors.ts";

export const ALLOWED_PROXY_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH"]);
export const MAX_PROXY_TTL_SECONDS = 86400; // 24 hours max
export const MAX_BODY_SIZE_BYTES = 1024 * 1024; // 1MB max edge body

export async function handleUniversalProxy(
  req: Request,
  url: URL,
  requestId: string,
): Promise<Response> {
  const method = req.method.toUpperCase();
  if (!ALLOWED_PROXY_METHODS.has(method)) {
    throw GlastorError.badRequest(
      `Unsupported HTTP method '${req.method}'`,
      `Proxy only supports methods: ${Array.from(ALLOWED_PROXY_METHODS).join(", ")}`,
      "Use a supported HTTP method.",
      requestId,
    );
  }

  // Expected format: /v1/proxy/:upstream_service_or_path/*
  const prefix = "/v1/proxy";
  const upstreamPath = url.pathname.slice(prefix.length);

  if (!upstreamPath || upstreamPath === "/" || upstreamPath === "") {
    throw GlastorError.badRequest(
      "Missing target APILayer path in proxy request",
      "No subpath provided after /v1/proxy/",
      "Specify upstream path, e.g. /v1/proxy/exchangerates_data/latest?symbols=EUR,GBP",
      requestId,
    );
  }

  // Derive service identifier for circuit breaker isolation
  const segments = upstreamPath.split("/").filter(Boolean);
  const serviceName = segments[0] || "default_proxy";

  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (!/^(apikey|access_key)$/i.test(k)) {
      params[k] = v;
    }
  }

  // Optional custom TTL header from client (validated and bounded)
  const customTtl = req.headers.get("x-medusa-ttl");
  let ttlSeconds: number | undefined = undefined;
  if (customTtl) {
    const parsed = parseInt(customTtl, 10);
    if (isNaN(parsed) || parsed < 0) {
      throw GlastorError.badRequest(
        "Invalid x-medusa-ttl header",
        `Received '${customTtl}', expected a positive integer.`,
        "Provide a valid number of seconds (max 86400).",
        requestId,
      );
    }
    ttlSeconds = Math.min(parsed, MAX_PROXY_TTL_SECONDS);
  }

  const skipCache = req.headers.get("x-medusa-no-cache") === "true";

  let body: unknown = undefined;
  if (method !== "GET" && method !== "HEAD") {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      throw GlastorError.badRequest(
        "Payload Too Large",
        `Request body exceeds maximum allowed size of ${MAX_BODY_SIZE_BYTES} bytes.`,
        "Reduce payload size under 1MB.",
        requestId,
      );
    }
    try {
      body = await req.json();
    } catch {
      // Body may be empty or non-JSON
    }
  }

  const res = await apilayerClient.request({
    service: serviceName,
    path: upstreamPath,
    params,
    method: req.method,
    body,
    ttlSeconds,
    skipCache,
    requestId,
  });

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "x-glastor-request-id": requestId,
    "x-glastor-service": serviceName,
    "x-glastor-cache": res.cacheStatus,
    "x-glastor-age": String(res.ageSeconds),
    "x-glastor-latency-ms": String(res.latencyMs),
    ...(res.singleFlightShared ? { "x-glastor-single-flight": "COALESCED" } : {}),
  });

  return new Response(JSON.stringify(res.data, null, 2), { status: 200, headers });
}
