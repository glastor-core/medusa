/**
 * GLASTOR® Medusa - Currency & FX Resilient Handler
 * Endpoints for live exchange rates and currency conversion.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { GlastorError } from "../core/errors.ts";

export async function handleCurrency(
  _req: Request,
  url: URL,
  requestId: string,
): Promise<Response> {
  const pathname = url.pathname;

  if (pathname === "/v1/currency/convert") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const amount = url.searchParams.get("amount") || "1";

    if (!from || !to) {
      throw GlastorError.badRequest(
        "Missing required query parameters",
        "Parameters 'from' and 'to' currency codes are required.",
        "Provide parameters like: /v1/currency/convert?from=USD&to=EUR&amount=100",
        requestId,
      );
    }

    const res = await apilayerClient.request({
      service: "currency_convert",
      path: "/exchangerates_data/convert",
      params: { from: from.toUpperCase(), to: to.toUpperCase(), amount },
      ttlSeconds: 600, // 10 minutes cache
      requestId,
    });

    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "x-glastor-request-id": requestId,
      "x-glastor-cache": res.cacheStatus,
      "x-glastor-age": String(res.ageSeconds),
      "x-glastor-latency-ms": String(res.latencyMs),
    });

    return new Response(JSON.stringify(res.data, null, 2), { status: 200, headers });
  }

  if (pathname === "/v1/currency/latest") {
    const base = url.searchParams.get("base") || "USD";
    const symbols = url.searchParams.get("symbols") || "";

    const res = await apilayerClient.request({
      service: "currency_latest",
      path: "/exchangerates_data/latest",
      params: { base: base.toUpperCase(), symbols: symbols.toUpperCase() },
      ttlSeconds: 900, // 15 minutes cache
      requestId,
    });

    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "x-glastor-request-id": requestId,
      "x-glastor-cache": res.cacheStatus,
      "x-glastor-age": String(res.ageSeconds),
      "x-glastor-latency-ms": String(res.latencyMs),
    });

    return new Response(JSON.stringify(res.data, null, 2), { status: 200, headers });
  }

  throw GlastorError.badRequest(
    "Invalid currency sub-route",
    `Route '${pathname}' not recognized for currency service.`,
    "Supported routes are /v1/currency/convert and /v1/currency/latest",
    requestId,
  );
}
