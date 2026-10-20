/**
 * Tests for RateLimiter distributed window and backpressure.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { RateLimiter } from "../src/core/rate_limiter.ts";

Deno.test("RateLimiter - allows requests under the limit", async () => {
  const limiter = new RateLimiter(5, 60);

  const res1 = await limiter.check("client-a", 5, 60);
  assertEquals(res1.allowed, true);
  assertEquals(res1.remaining, 4);

  const res2 = await limiter.check("client-a", 5, 60);
  assertEquals(res2.allowed, true);
  assertEquals(res2.remaining, 3);
});

Deno.test("RateLimiter - blocks requests exceeding quota", async () => {
  const limiter = new RateLimiter(2, 60);

  await limiter.check("client-b", 2, 60); // 1st
  await limiter.check("client-b", 2, 60); // 2nd

  // 3rd should be blocked
  const res3 = await limiter.check("client-b", 2, 60);
  assertEquals(res3.allowed, false);
  assertEquals(res3.remaining, 0);

  // Headers formatting
  const headers = new Headers();
  limiter.applyHeaders(headers, res3);
  assertEquals(headers.get("RateLimit-Limit"), "2");
  assertEquals(headers.get("RateLimit-Remaining"), "0");
  assertEquals(headers.has("Retry-After"), true);
});
