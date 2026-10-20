/**
 * GLASTOR® Medusa - Email Verification & Deliverability Handler
 * Validates email formatting, MX records, and disposable email detection.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { GlastorError } from "../core/errors.ts";

export async function handleEmailVerify(
  _req: Request,
  url: URL,
  requestId: string,
): Promise<Response> {
  const pathname = url.pathname;

  if (pathname === "/v1/email-verify/check" || pathname === "/v1/email-verify") {
    const email = url.searchParams.get("email");

    if (!email) {
      throw GlastorError.badRequest(
        "Missing email parameter",
        "The 'email' query parameter is required to verify an address.",
        "Provide a valid email: /v1/email-verify/check?email=user@example.com",
        requestId,
      );
    }

    const res = await apilayerClient.request({
      service: "email_verification",
      path: "/email_verification/check",
      params: { email },
      ttlSeconds: 3600, // 1 hour cache
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
    "Invalid email-verify sub-route",
    `Route '${pathname}' not recognized for email verification service.`,
    "Supported route is /v1/email-verify/check?email=<email>",
    requestId,
  );
}
