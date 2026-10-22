/**
 * Tests for EdgeCache L1/L2 and Stale-While-Revalidate logic.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { EdgeCache } from "../src/core/cache.ts";

Deno.test("EdgeCache - generates deterministic keys regardless of param order", () => {
  const cache = new EdgeCache();
  const key1 = cache.generateKey("currency", { from: "USD", to: "EUR", amount: 100 });
  const key2 = cache.generateKey("currency", { amount: 100, to: "EUR", from: "USD" });

  assertEquals(key1, key2);
  assertEquals(key1, "currency:amount=100&from=USD&to=EUR");
});

Deno.test("EdgeCache - sets and retrieves HIT entry", async () => {
  const cache = new EdgeCache(10, 60);
  const key = cache.generateKey("geoip", { ip: "1.1.1.1" });

  // Initially MISS
  const initial = await cache.get(key);
  assertEquals(initial.status, "MISS");
  assertEquals(initial.entry, null);

  // Store data
  await cache.set(key, { country: "Australia" }, 10);

  // Should now be HIT
  const hit = await cache.get<{ country: string }>(key);
  assertEquals(hit.status, "HIT");
  assertEquals(hit.entry?.data.country, "Australia");
});

Deno.test("EdgeCache - evaluates STALE within grace period", async () => {
  // TTL = 1s, Grace = 5s
  const cache = new EdgeCache(1, 5);
  const key = "test:stale";

  await cache.set(key, { value: 42 }, 1);

  // Wait 1.1s for TTL expiry
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const result = await cache.get<{ value: number }>(key);
  assertEquals(result.status, "STALE");
  assertEquals(result.entry?.data.value, 42);
});

Deno.test("EdgeCache - enforces bounded L1 LRU eviction capacity", async () => {
  // maxL1Entries = 2
  const cache = new EdgeCache(60, 3600, 2);

  await cache.set("key1", "data1");
  await cache.set("key2", "data2");
  assertEquals(cache.getMetrics().l1Size, 2);

  // Access key1 to refresh its LRU position
  await cache.get("key1");

  // Add key3, should evict key2 (the least recently used)
  await cache.set("key3", "data3");
  assertEquals(cache.getMetrics().l1Size, 2);
  assertEquals(cache.getMetrics().evictions, 1);

  const hit1 = await cache.get("key1");
  assertEquals(hit1.status, "HIT");
  const hit3 = await cache.get("key3");
  assertEquals(hit3.status, "HIT");
});
