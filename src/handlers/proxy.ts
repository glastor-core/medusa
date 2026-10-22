/**
 * GLASTOR® Medusa - Universal APILayer Resilient Proxy Handler
 * Proxies any APILayer endpoint through Medusa with edge caching and circuit breakers.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { GlastorError } from "../core/errors.ts";

export async function handleUniversalProxy(
  req: Request,
  url: URL,
  requestId: string,
): Promise<Response> {
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

  // Optional custom TTL header from client
  const customTtl = req.headers.get("x-medusa-ttl");
  const ttlSeconds = customTtl ? parseInt(customTtl, 10) : undefined;
  const skipCache = req.headers.get("x-medusa-no-cache") === "true";

  let body: unknown = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
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
