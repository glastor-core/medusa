/**
 * GLASTOR® Medusa - Core 4R Observability & GlastorError Standard
 * 4R: Reason, Recovery, Remediation, RequestId
 */

export interface GlastorErrorPayload {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly reason: string;
    readonly recovery: string;
    readonly remediation: string;
    readonly requestId: string;
    readonly timestamp: string;
    readonly details?: unknown;
  };
}

export class GlastorError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly reason: string;
  readonly recovery: string;
  readonly remediation: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly details?: unknown;

  constructor(params: {
    code: string;
    statusCode: number;
    message: string;
    reason: string;
    recovery: string;
    remediation: string;
    requestId?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "GlastorError";
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.reason = params.reason;
    this.recovery = params.recovery;
    this.remediation = params.remediation;
    this.requestId = params.requestId || crypto.randomUUID();
    this.timestamp = new Date().toISOString();
    this.details = params.details;
  }

  toPayload(): GlastorErrorPayload {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        reason: this.reason,
        recovery: this.recovery,
        remediation: this.remediation,
        requestId: this.requestId,
        timestamp: this.timestamp,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }

  toResponse(headers?: HeadersInit): Response {
    const defaultHeaders = new Headers(headers);
    defaultHeaders.set("Content-Type", "application/json; charset=utf-8");
    defaultHeaders.set("x-glastor-request-id", this.requestId);
    defaultHeaders.set("x-glastor-error-code", this.code);

    return new Response(JSON.stringify(this.toPayload(), null, 2), {
      status: this.statusCode,
      headers: defaultHeaders,
    });
  }

  // Pre-configured standard factory methods
  static badRequest(
    message: string,
    reason: string,
    remediation: string,
    requestId?: string,
  ): GlastorError {
    return new GlastorError({
      code: "GLASTOR_BAD_REQUEST",
      statusCode: 400,
      message,
      reason,
      recovery: "Request was rejected immediately without forwarding to upstream.",
      remediation,
      requestId,
    });
  }

  static unauthorized(
    reason = "Missing or invalid API authorization token",
    requestId?: string,
  ): GlastorError {
    return new GlastorError({
      code: "GLASTOR_UNAUTHORIZED",
      statusCode: 401,
      message: "Authentication failed",
      reason,
      recovery: "Request blocked at edge perimeter before reaching services.",
      remediation: "Provide a valid 'x-medusa-key' header or 'Authorization: Bearer <key>' token.",
      requestId,
    });
  }

  static rateLimitExceeded(limit: number, resetSeconds: number, requestId?: string): GlastorError {
    return new GlastorError({
      code: "GLASTOR_RATE_LIMIT_EXCEEDED",
      statusCode: 429,
      message: "Gateway rate limit exceeded",
      reason: `Request rate exceeded quota of ${limit} requests per minute window.`,
      recovery: "Applied token bucket backpressure to preserve upstream and gateway stability.",
      remediation: `Back off and retry after ${resetSeconds} seconds or upgrade tier.`,
      requestId,
    });
  }

  static circuitOpen(service: string, resetInMs: number, requestId?: string): GlastorError {
    return new GlastorError({
      code: "GLASTOR_CIRCUIT_BREAKER_OPEN",
      statusCode: 503,
      message: `Upstream service '${service}' is currently unavailable`,
      reason: "Circuit breaker is in OPEN state due to high upstream failure/timeout rate.",
      recovery:
        "Fast-failed immediately at edge to prevent cascade failure and preserve APILayer quotas.",
      remediation: `Wait approximately ${
        Math.round(resetInMs / 1000)
      }s until the circuit enters HALF_OPEN probe state.`,
      requestId,
    });
  }

  static upstreamError(
    service: string,
    status: number,
    rawMessage: string,
    staleCacheUsed = false,
    requestId?: string,
  ): GlastorError {
    return new GlastorError({
      code: "GLASTOR_UPSTREAM_ERROR",
      statusCode: staleCacheUsed ? 200 : 502,
      message: `Upstream APILayer returned error status ${status}`,
      reason: `APILayer service '${service}' failed with: ${rawMessage}`,
      recovery: staleCacheUsed
        ? "Served degraded response from local Deno KV cache (stale-while-revalidate)."
        : "Recorded failure event in Circuit Breaker; no valid cache fallback available.",
      remediation: "Check upstream APILayer credentials, status, or endpoint parameters.",
      requestId,
    });
  }

  static internal(message: string, error?: unknown, requestId?: string): GlastorError {
    return new GlastorError({
      code: "GLASTOR_INTERNAL_ERROR",
      statusCode: 500,
      message,
      reason: error instanceof Error
        ? error.message
        : "Unexpected internal gateway execution error.",
      recovery: "Error captured by global edge panic handler.",
      remediation: "Inspect application telemetry or file an issue on GitHub.",
      requestId,
      details: error instanceof Error ? { stack: error.stack } : error,
    });
  }
}
