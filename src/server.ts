/**
 * GLASTOR® Medusa - Edge Kernel Server
 * Entrypoint for Deno Deploy & Local Development
 */
import { config, MEDUSA_VERSION } from "./config.ts";
import { rateLimiter } from "./core/rate_limiter.ts";
import { edgeCache } from "./core/cache.ts";
import { GlastorError } from "./core/errors.ts";
import { logger } from "./core/logger.ts";
import { handleCurrency } from "./handlers/currency.ts";
import { handleGeoIp } from "./handlers/geoip.ts";
import { handleEmailVerify } from "./handlers/email.ts";
import { handleUniversalProxy } from "./handlers/proxy.ts";
import { handleHealth, handleLiveness, handleOpenApi, handleReadiness } from "./handlers/health.ts";
import { renderDashboardHtml } from "./ui/dashboard.ts";
import { prewarmEngine } from "./core/prewarm.ts";
import { edgeCompressor } from "./core/compression.ts";

// Initialize async edge dependencies (Deno KV & background cron)
await Promise.all([
  rateLimiter.init(),
  edgeCache.init(),
]);
prewarmEngine.init();

export function extractClientIp(req: Request, info?: Deno.ServeHandlerInfo): string {
  // 1. Direct socket peer address if provided by Deno runtime
  const socketIp = (info?.remoteAddr as Deno.NetAddr)?.hostname;

  // 2. Cloudflare Connecting IP (trusted when edge is behind Cloudflare)
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();

  // 3. X-Real-IP header from trusted upstream edge/reverse proxy
  const realIp = req.headers.get("x-real-ip")?.trim();

  // 4. X-Forwarded-For: take the rightmost (last hop) IP to prevent client-spoofed prefix
  const xff = req.headers.get("x-forwarded-for");
  let lastXffIp: string | undefined;
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    lastXffIp = parts[parts.length - 1];
  }

  return cfIp || realIp || socketIp || lastXffIp || "127.0.0.1";
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  let allowOrigin = "*";

  if (config.corsAllowedOrigins.includes("*")) {
    allowOrigin = "*";
  } else if (origin && config.corsAllowedOrigins.includes(origin)) {
    allowOrigin = origin;
  } else if (config.corsAllowedOrigins.length > 0) {
    allowOrigin = config.corsAllowedOrigins[0];
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...(allowOrigin !== "*" ? { "Vary": "Origin" } : {}),
  };
}

export async function handler(req: Request, info?: Deno.ServeHandlerInfo): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  const corsHeaders = getCorsHeaders(req);

  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-medusa-key, x-medusa-ttl, x-medusa-no-cache",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 2. Identify client for Rate Limiting & Auth
  const clientIp = extractClientIp(req, info);
  const authHeader = req.headers.get("authorization");
  const customHeader = req.headers.get("x-medusa-key");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || customHeader;

  // Rate Limiting Check (bypass for health/readiness/liveness probes and openapi)
  const isExempt = url.pathname === "/health" ||
    url.pathname === "/livez" ||
    url.pathname === "/readyz" ||
    url.pathname === "/openapi.json" ||
    url.pathname === "/";

  // Rate limit by client credential when provided, otherwise by IP
  const rateLimitIdentifier = token ? `key:${token}` : `ip:${clientIp}`;

  if (!isExempt) {
    const rateCheck = await rateLimiter.check(
      rateLimitIdentifier,
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
      for (const [k, v] of Object.entries(corsHeaders)) {
        res.headers.set(k, v);
      }
      logger.warn("Rate limit exceeded for client", {
        requestId,
        clientIp,
        identifier: rateLimitIdentifier,
        limit: rateCheck.limit,
      });
      return res;
    }
  }

  // 3. Client Authorization check (Fail-closed in production or when authRequired is active)
  if (!isExempt) {
    if (config.authRequired && !config.medusaApiKey) {
      const err = new GlastorError({
        code: "GLASTOR_GATEWAY_MISCONFIGURATION",
        statusCode: 500,
        message: "Gateway misconfiguration: MEDUSA_API_KEY must be set in production mode",
        reason: "The perimeter gateway requires authentication, but no server key is configured.",
        recovery: "Check Deno Deploy environment variables.",
        remediation: "Set MEDUSA_API_KEY in the deployment dashboard.",
        requestId,
      });
      logger.error("Request blocked due to missing production MEDUSA_API_KEY", { requestId });
      const res = err.toResponse();
      for (const [k, v] of Object.entries(corsHeaders)) {
        res.headers.set(k, v);
      }
      return res;
    }

    if (config.medusaApiKey) {
      if (!token || token !== config.medusaApiKey) {
        const err = GlastorError.unauthorized(
          "Client provided invalid or missing Medusa API key.",
          requestId,
        );
        logger.warn("Unauthorized request blocked", { requestId, clientIp });
        const res = err.toResponse();
        for (const [k, v] of Object.entries(corsHeaders)) {
          res.headers.set(k, v);
        }
        return res;
      }
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
              version: MEDUSA_VERSION,
              documentation: "/openapi.json",
              telemetry: "/health",
              probes: {
                liveness: "/livez",
                readiness: "/readyz",
              },
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
    } else if (url.pathname === "/livez") {
      response = handleLiveness(req, url, requestId);
    } else if (url.pathname === "/readyz") {
      response = await handleReadiness(req, url, requestId);
    } else if (url.pathname === "/health") {
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

    // Apply configured CORS & telemetry headers
    for (const [k, v] of Object.entries(corsHeaders)) {
      response.headers.set(k, v);
    }
    response.headers.set("x-glastor-request-id", requestId);
    return edgeCompressor.compress(req, response);
  } catch (err) {
    if (err instanceof GlastorError) {
      const res = err.toResponse();
      for (const [k, v] of Object.entries(corsHeaders)) {
        res.headers.set(k, v);
      }
      return edgeCompressor.compress(req, res);
    }

    logger.error("Unexpected edge execution error", { requestId }, err);
    const internalErr = GlastorError.internal(
      "An unexpected edge execution error occurred",
      err,
      requestId,
    );
    const res = internalErr.toResponse();
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.headers.set(k, v);
    }
    return edgeCompressor.compress(req, res);
  }
}

// Start server when executed directly
if (import.meta.main) {
  logger.info(`⚡ GLASTOR® Medusa Gateway listening on http://localhost:${config.port}`, {
    port: config.port,
    env: config.env,
  });
  Deno.serve({ port: config.port }, (req, info) => handler(req, info));
}

export default { fetch: handler };
