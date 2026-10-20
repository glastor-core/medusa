/**
 * Tests for PrewarmEngine.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { PrewarmEngine } from "../src/core/prewarm.ts";

Deno.test("PrewarmEngine - starts in IDLE status and reports metrics", () => {
  const engine = new PrewarmEngine();
  const metrics = engine.getMetrics();

  assertEquals(metrics.lastStatus, "IDLE");
  assertEquals(metrics.totalRuns, 0);
  assertEquals(metrics.lastRunTime, null);
  assertEquals(metrics.prewarmedItems.length >= 2, true);
});

Deno.test("PrewarmEngine - skips execution safely when API key is unconfigured", async () => {
  const engine = new PrewarmEngine();
  const result = await engine.runNow();

  assertEquals(result, false);
  assertEquals(engine.getMetrics().totalRuns, 0);
});
