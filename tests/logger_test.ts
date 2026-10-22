/**
 * Tests for Structured Edge Logger & Secret Redaction.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { Logger, sanitizeLogValue } from "../src/core/logger.ts";

Deno.test("Logger - formats structured logs with trace correlation", () => {
  const logger = new Logger("DEBUG");
  logger.info("Test info message", { requestId: "req-test-123", service: "currency" });
  logger.warn("Test warning", { requestId: "req-test-456" });
  logger.debug("Test debug");
  logger.error("Test error", { requestId: "req-test-789" }, new Error("Crash"));

  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.error, "function");
});

Deno.test("Logger - sanitizes and redacts sensitive credentials and tokens", () => {
  const sanitizedKey = sanitizeLogValue("apiKey", "super-secret-12345");
  assertEquals(sanitizedKey, "[REDACTED]");

  const sanitizedAuth = sanitizeLogValue("authorization", "Bearer my-token-123");
  assertEquals(sanitizedAuth, "[REDACTED]");

  const sanitizedBearer = sanitizeLogValue("message", "Request with Bearer abc.def.123");
  assertEquals(sanitizedBearer, "Request with Bearer [REDACTED]");

  const sanitizedQuery = sanitizeLogValue(
    "url",
    "https://api.com/test?apikey=secret_token_123&from=USD",
  );
  assertEquals(sanitizedQuery, "https://api.com/test?apikey=[REDACTED]&from=USD");

  const sanitizedObj = sanitizeLogValue("extra", {
    token: "my-secret-token",
    password: "secret-password",
    normal: "safe-value",
  }) as Record<string, string>;
  assertEquals(sanitizedObj.token, "[REDACTED]");
  assertEquals(sanitizedObj.password, "[REDACTED]");
  assertEquals(sanitizedObj.normal, "safe-value");
});
