/**
 * GLASTOR® Medusa - Structured Edge Logger
 * High-performance, zero-dependency structured logger with trace correlation for Deno Deploy.
 */

import { config } from "../config.ts";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

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

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      const { requestId, service, latencyMs, ...extra } = context;
      if (requestId) entry.requestId = requestId;
      if (service) entry.service = service;
      if (latencyMs !== undefined) entry.latencyMs = latencyMs;
      if (Object.keys(extra).length > 0) entry.extra = extra;
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
      } else {
        entry.error = {
          name: "UnknownError",
          message: String(err),
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
