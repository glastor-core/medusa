/**
 * Tests for Core 4R Observability & GlastorError.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { GlastorError } from "../src/core/errors.ts";

Deno.test("GlastorError - formats standard 4R payload", () => {
  const err = new GlastorError({
    code: "GLASTOR_TEST_ERROR",
    statusCode: 400,
    message: "Invalid input",
    reason: "Missing required key",
    recovery: "Rejected at perimeter",
    remediation: "Check documentation",
    requestId: "req-123",
  });

  const payload = err.toPayload();
  assertEquals(payload.success, false);
  assertEquals(payload.error.code, "GLASTOR_TEST_ERROR");
  assertEquals(payload.error.reason, "Missing required key");
  assertEquals(payload.error.recovery, "Rejected at perimeter");
  assertEquals(payload.error.remediation, "Check documentation");
  assertEquals(payload.error.requestId, "req-123");
});

Deno.test("GlastorError - serializes to HTTP Response with headers", async () => {
  const err = GlastorError.circuitOpen("currency", 30000, "req-456");
  const response = err.toResponse();

  assertEquals(response.status, 503);
  assertEquals(response.headers.get("x-glastor-request-id"), "req-456");
  assertEquals(response.headers.get("x-glastor-error-code"), "GLASTOR_CIRCUIT_BREAKER_OPEN");

  const json = await response.json();
  assertEquals(json.error.code, "GLASTOR_CIRCUIT_BREAKER_OPEN");
  assertEquals(json.error.remediation.includes("30s"), true);
});
