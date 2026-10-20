/**
 * Tests for CircuitBreaker core resilience engine.
 */

import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.11";
import { CircuitBreaker } from "../src/core/circuit_breaker.ts";

Deno.test("CircuitBreaker - normal operation stays CLOSED on success", async () => {
  const cb = new CircuitBreaker("test-service", { failureThreshold: 3 });
  assertEquals(cb.getState(), "CLOSED");

  const result = await cb.execute(() => Promise.resolve("ok"));
  assertEquals(result, "ok");
  assertEquals(cb.getState(), "CLOSED");
});

Deno.test("CircuitBreaker - transitions to OPEN after threshold failures", async () => {
  const cb = new CircuitBreaker("test-fail-service", {
    failureThreshold: 2,
    resetTimeoutMs: 100,
  });

  // 1st failure
  await assertRejects(() =>
    cb.execute(() => {
      return Promise.reject(new Error("Upstream error 1"));
    })
  );
  assertEquals(cb.getState(), "CLOSED");

  // 2nd failure - threshold reached
  await assertRejects(() =>
    cb.execute(() => {
      return Promise.reject(new Error("Upstream error 2"));
    })
  );
  assertEquals(cb.getState(), "OPEN");

  // Subsequent call fast-fails immediately
  await assertRejects(
    () => cb.execute(() => Promise.resolve("should not execute")),
    Error,
    "is OPEN. Fast-fail active.",
  );
});

Deno.test("CircuitBreaker - invokes fallback when OPEN or failed", async () => {
  const cb = new CircuitBreaker("test-fallback-service", {
    failureThreshold: 1,
    resetTimeoutMs: 500,
  });

  // Cause OPEN
  await assertRejects(() =>
    cb.execute(() => {
      return Promise.reject(new Error("Fatal 500"));
    })
  );
  assertEquals(cb.getState(), "OPEN");

  // Execute with fallback
  const result = await cb.execute(
    () => Promise.reject(new Error("failed call")),
    () => Promise.resolve("resilient fallback data"),
  );

  assertEquals(result, "resilient fallback data");
});

Deno.test("CircuitBreaker - transitions to HALF_OPEN after timeout and recovers to CLOSED", async () => {
  const cb = new CircuitBreaker("test-recovery-service", {
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenMaxProbes: 2,
  });

  // Trip to OPEN
  await assertRejects(() =>
    cb.execute(() => {
      return Promise.reject(new Error("Down"));
    })
  );
  assertEquals(cb.getState(), "OPEN");

  // Wait for reset timeout
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should now evaluate to HALF_OPEN
  assertEquals(cb.getState(), "HALF_OPEN");

  // Probe 1 succeeds
  await cb.execute(() => Promise.resolve("probe 1"));
  // Probe 2 succeeds
  await cb.execute(() => Promise.resolve("probe 2"));

  // Should transition back to CLOSED
  assertEquals(cb.getState(), "CLOSED");
});
