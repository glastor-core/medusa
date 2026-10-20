/**
 * Tests for SingleFlight request deduplication.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { SingleFlightGroup } from "../src/core/single_flight.ts";

Deno.test("SingleFlight - executes fn once when called sequentially", async () => {
  const group = new SingleFlightGroup();
  let count = 0;

  const fn = () => {
    count++;
    return Promise.resolve("result");
  };

  const res1 = await group.do("key1", fn);
  const res2 = await group.do("key1", fn);

  assertEquals(count, 2);
  assertEquals(res1.shared, false);
  assertEquals(res2.shared, false);
});

Deno.test("SingleFlight - coalesces concurrent duplicate calls into a single invocation", async () => {
  const group = new SingleFlightGroup();
  let executionCount = 0;

  const slowUpstream = async () => {
    executionCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { rates: { EUR: 0.92 } };
  };

  // Launch 5 concurrent calls with the exact same key
  const [r1, r2, r3, r4, r5] = await Promise.all([
    group.do("currency:USD:EUR", slowUpstream),
    group.do("currency:USD:EUR", slowUpstream),
    group.do("currency:USD:EUR", slowUpstream),
    group.do("currency:USD:EUR", slowUpstream),
    group.do("currency:USD:EUR", slowUpstream),
  ]);

  // Only 1 outbound execution must have occurred
  assertEquals(executionCount, 1);
  assertEquals(r1.data, { rates: { EUR: 0.92 } });
  assertEquals(r2.data, { rates: { EUR: 0.92 } });

  // Exactly 1 leader and 4 deduplicated followers
  const sharedCount = [r1, r2, r3, r4, r5].filter((r) => r.shared).length;
  assertEquals(sharedCount, 4);

  const metrics = group.getMetrics();
  assertEquals(metrics.totalCalls, 5);
  assertEquals(metrics.deduplicatedCalls, 4);
  assertEquals(metrics.activeFlights, 0);
});

Deno.test("SingleFlight - cleans up flight on error without hanging subsequent calls", async () => {
  const group = new SingleFlightGroup();

  let failed = false;
  try {
    await group.do("error-key", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      throw new Error("Network timeout");
    });
  } catch {
    failed = true;
  }

  assertEquals(failed, true);
  assertEquals(group.getMetrics().activeFlights, 0);

  // Subsequent call should succeed independently
  const res = await group.do("error-key", () => Promise.resolve("recovered"));
  assertEquals(res.data, "recovered");
  assertEquals(res.shared, false);
});
