/**
 * GLASTOR® Medusa - Structured Edge Logger
 * High-performance, zero-dependency structured logger with automated secret redaction for Deno Deploy.
 */

import { config } from "../config.ts";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const SENSITIVE_KEY_REGEX =
  /^(api[-_]?key|authorization|bearer|token|secret|password|cookie|credential|x-medusa-key)$/i;

/**
 * Recursively sanitizes objects and strings to redact sensitive tokens, credentials, and API keys.
 */
export function sanitizeLogValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_REGEX.test(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    let sanitized = value;
    // Redact Bearer tokens
    if (/bearer\s+[a-z0-9_\-\.]+/i.test(sanitized)) {
      sanitized = sanitized.replace(/bearer\s+[a-z0-9_\-\.]+/gi, "Bearer [REDACTED]");
    }
    // Redact URL query parameter keys
    if (/(apikey|access_key|api_key|token)=[a-z0-9_\-]+/i.test(sanitized)) {
      sanitized = sanitized.replace(
        /(apikey|access_key|api_key|token)=[a-z0-9_\-]+/gi,
        "$1=[REDACTED]",
      );
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(key, item));
  }

  if (value && typeof value === "object" && !(value instanceof Error)) {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[k] = sanitizeLogValue(k, v);
    }
    return sanitizedObj;
  }

  return value;
}

export interface LogContext {
  requestId?: string;
  service?: string;
  latencyMs?: number;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  service?: string;
  latencyMs?: number;
  extra?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private minLevel: LogLevel;

  constructor(minLevel?: LogLevel) {
    const envLevel = (Deno.env.get("LOG_LEVEL") || "").toUpperCase() as LogLevel;
    this.minLevel = minLevel || envLevel || (config.env === "production" ? "INFO" : "DEBUG");
  }

  private shouldLog(level: LogLevel): boolean {
    const priority = LOG_LEVEL_PRIORITY[level] ?? 20;
    const threshold = LOG_LEVEL_PRIORITY[this.minLevel] ?? 20;
    return priority >= threshold;
  }

  private write(
    level: LogLevel,
    message: string,
    context?: LogContext,
    err?: unknown,
  ): void {
    if (!this.shouldLog(level)) return;

    const sanitizedMessage = sanitizeLogValue("message", message) as string;

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMessage,
    };

    if (context) {
      const { requestId, service, latencyMs, ...extra } = context;
      if (requestId) entry.requestId = requestId;
      if (service) entry.service = service;
      if (latencyMs !== undefined) entry.latencyMs = latencyMs;
      if (Object.keys(extra).length > 0) {
        entry.extra = sanitizeLogValue("extra", extra) as Record<string, unknown>;
      }
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: sanitizeLogValue("message", err.message) as string,
          stack: config.env === "production" ? undefined : err.stack,
        };
      } else {
        entry.error = {
          name: "UnknownError",
          message: sanitizeLogValue("message", String(err)) as string,
        };
      }
    }

    const json = JSON.stringify(entry);

    if (level === "ERROR") {
      console.error(json);
    } else if (level === "WARN") {
      console.warn(json);
    } else {
      console.log(json);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.write("DEBUG", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write("INFO", message, context);
  }

  warn(message: string, context?: LogContext, err?: unknown): void {
    this.write("WARN", message, context, err);
  }

  error(message: string, context?: LogContext, err?: unknown): void {
    this.write("ERROR", message, context, err);
  }
}

export const logger = new Logger();
