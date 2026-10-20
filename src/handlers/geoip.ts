/**
 * GLASTOR® Medusa - IP Geolocation & Threat Intelligence Handler
 * Resolves IP geolocation and security metadata via APILayer.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { GlastorError } from "../core/errors.ts";

export async function handleGeoIp(req: Request, url: URL, requestId: string): Promise<Response> {
  const pathname = url.pathname;

  if (pathname === "/v1/ip-geo/lookup" || pathname === "/v1/ip-geo") {
    // If no IP is passed in query, attempt to detect from client request headers
    let ip = url.searchParams.get("ip");
    if (!ip) {
      ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("cf-connecting-ip") ||
        "check";
    }

    const res = await apilayerClient.request({
      service: "ip_geolocation",
      path: `/ipstack/${ip}`,
      ttlSeconds: 86400, // 24 hours cache for IP locations
      requestId,
    });

    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "x-glastor-request-id": requestId,
      "x-glastor-cache": res.cacheStatus,
      "x-glastor-age": String(res.ageSeconds),
      "x-glastor-latency-ms": String(res.latencyMs),
      ...(res.singleFlightShared ? { "x-glastor-single-flight": "COALESCED" } : {}),
    });

    return new Response(JSON.stringify(res.data, null, 2), { status: 200, headers });
  }

  throw GlastorError.badRequest(
    "Invalid IP geolocation sub-route",
    `Route '${pathname}' not recognized for ip-geo service.`,
    "Supported route is /v1/ip-geo/lookup?ip=<ip_address>",
    requestId,
  );
}
