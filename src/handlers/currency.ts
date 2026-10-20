/**
 * GLASTOR® Medusa - Currency & FX Resilient Handler
 * Endpoints for live exchange rates and currency conversion.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { GlastorError } from "../core/errors.ts";
import { CurrencyConvertSchema, CurrencyLatestSchema, validateInput } from "../core/validation.ts";

export async function handleCurrency(
  _req: Request,
  url: URL,
  requestId: string,
): Promise<Response> {
  const pathname = url.pathname;

  if (pathname === "/v1/currency/convert") {
    const input = validateInput(
      CurrencyConvertSchema,
      {
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        amount: url.searchParams.get("amount") || undefined,
      },
      requestId,
    );

    const res = await apilayerClient.request({
      service: "currency_convert",
      path: "/exchangerates_data/convert",
      params: { from: input.from, to: input.to, amount: input.amount },
      ttlSeconds: 600, // 10 minutes cache
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

  if (pathname === "/v1/currency/latest") {
    const input = validateInput(
      CurrencyLatestSchema,
      {
        base: url.searchParams.get("base") || undefined,
        symbols: url.searchParams.get("symbols") || undefined,
      },
      requestId,
    );

    const res = await apilayerClient.request({
      service: "currency_latest",
      path: "/exchangerates_data/latest",
      params: { base: input.base, symbols: input.symbols },
      ttlSeconds: 900, // 15 minutes cache
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
    "Invalid currency sub-route",
    `Route '${pathname}' not recognized for currency service.`,
    "Supported routes are /v1/currency/convert and /v1/currency/latest",
    requestId,
  );
}
