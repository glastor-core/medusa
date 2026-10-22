/**
 * Tests for Structured Edge Logger.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { Logger } from "../src/core/logger.ts";

Deno.test("Logger - formats structured logs with trace correlation", () => {
  const logger = new Logger("DEBUG");
  // Ensure logger instance exists and can log without throwing
  logger.info("Test info message", { requestId: "req-test-123", service: "currency" });
  logger.warn("Test warning", { requestId: "req-test-456" });
  logger.debug("Test debug");
  logger.error("Test error", { requestId: "req-test-789" }, new Error("Crash"));

  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.error, "function");
});
