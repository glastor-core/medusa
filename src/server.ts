/**
 * GLASTOR® Medusa - Edge Kernel Server
 * Entrypoint for Deno Deploy & Local Development
 */

import { config } from "./config.ts";
import { rateLimiter } from "./core/rate_limiter.ts";
import { edgeCache } from "./core/cache.ts";
import { GlastorError } from "./core/errors.ts";
import { handleCurrency } from "./handlers/currency.ts";
import { handleGeoIp } from "./handlers/geoip.ts";
import { handleEmailVerify } from "./handlers/email.ts";
import { handleUniversalProxy } from "./handlers/proxy.ts";
import { handleHealth, handleOpenApi } from "./handlers/health.ts";
import { renderDashboardHtml } from "./ui/dashboard.ts";

// Initialize async edge dependencies (Deno KV)
await Promise.all([
  rateLimiter.init(),
  edgeCache.init(),
]);

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);

  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-medusa-key, x-medusa-ttl, x-medusa-no-cache",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 2. Identify client for Rate Limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "127.0.0.1";

  // Rate Limiting Check (bypass for /health and /openapi.json)
  const isExempt = url.pathname === "/health" || url.pathname === "/openapi.json" ||
    url.pathname === "/";
  if (!isExempt) {
    const rateCheck = await rateLimiter.check(
      clientIp,
      config.rateLimiter.maxRequests,
      config.rateLimiter.windowSeconds,
    );
    if (!rateCheck.allowed) {
      const err = GlastorError.rateLimitExceeded(
        rateCheck.limit,
        rateCheck.resetSeconds,
        requestId,
      );
      const res = err.toResponse();
      rateLimiter.applyHeaders(res.headers, rateCheck);
      return res;
    }
  }

  // 3. Optional Client Authorization check
  if (config.medusaApiKey && !isExempt) {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-medusa-key");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || customHeader;

    if (token !== config.medusaApiKey) {
      const err = GlastorError.unauthorized(
        "Client provided invalid or missing Medusa API key.",
        requestId,
      );
      return err.toResponse();
    }
  }

  // 4. Request Router
  try {
    let response: Response;

    // UI Dashboard or root metadata
    if (url.pathname === "/") {
      const accept = req.headers.get("accept") || "";
      if (accept.includes("text/html")) {
        response = new Response(renderDashboardHtml(), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "x-glastor-request-id": requestId,
          },
        });
      } else {
        response = new Response(
          JSON.stringify(
            {
              glastor: "Medusa APILayer Gateway",
              version: "0.1.0",
              documentation: "/openapi.json",
              telemetry: "/health",
              endpoints: [
                "/v1/currency/convert",
                "/v1/currency/latest",
                "/v1/ip-geo/lookup",
                "/v1/email-verify/check",
                "/v1/proxy/*",
              ],
              requestId,
            },
            null,
            2,
          ),
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "x-glastor-request-id": requestId,
            },
          },
        );
      }
    } else if (url.pathname === "/health" || url.pathname === "/livez") {
      response = handleHealth(req, url, requestId);
    } else if (url.pathname === "/openapi.json") {
      response = handleOpenApi(url, requestId);
    } else if (url.pathname.startsWith("/v1/currency")) {
      response = await handleCurrency(req, url, requestId);
    } else if (url.pathname.startsWith("/v1/ip-geo")) {
      response = await handleGeoIp(req, url, requestId);
    } else if (url.pathname.startsWith("/v1/email-verify")) {
      response = await handleEmailVerify(req, url, requestId);
    } else if (url.pathname.startsWith("/v1/proxy")) {
      response = await handleUniversalProxy(req, url, requestId);
    } else {
      throw GlastorError.badRequest(
        "Endpoint not found",
        `Path '${url.pathname}' does not match any registered Medusa Gateway routes.`,
        "Consult /openapi.json or the dashboard at / for available routes.",
        requestId,
      );
    }

    // Apply global CORS & telemetry headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("x-glastor-request-id", requestId);
    return response;
  } catch (err) {
    if (err instanceof GlastorError) {
      const res = err.toResponse();
      res.headers.set("Access-Control-Allow-Origin", "*");
      return res;
    }

    const internalErr = GlastorError.internal(
      "An unexpected edge execution error occurred",
      err,
      requestId,
    );
    const res = internalErr.toResponse();
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  }
}

// Start server when executed directly
if (import.meta.main) {
  console.log(`⚡ GLASTOR® Medusa Gateway listening on http://localhost:${config.port}`);
  Deno.serve({ port: config.port }, handler);
}

export default { fetch: handler };
