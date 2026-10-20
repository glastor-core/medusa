/**
 * Tests for EdgeStream compression.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { edgeCompressor } from "../src/core/compression.ts";

Deno.test("Compression - compresses response with gzip when requested", async () => {
  const req = new Request("http://localhost/test", {
    headers: { "accept-encoding": "gzip, deflate, br" },
  });

  const originalPayload = JSON.stringify({ message: "Hello from Glastor Medusa Gateway" });
  const originalRes = new Response(originalPayload, {
    headers: { "Content-Type": "application/json" },
  });

  const compressed = edgeCompressor.compress(req, originalRes);

  assertEquals(compressed.headers.get("Content-Encoding"), "gzip");
  assertEquals(compressed.headers.get("Vary"), "Accept-Encoding");

  // Decompress to verify data integrity
  const decompressedStream = compressed.body?.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(decompressedStream).text();
  assertEquals(text, originalPayload);
});

Deno.test("Compression - bypasses compression when client does not support it", () => {
  const req = new Request("http://localhost/test", {
    headers: { "accept-encoding": "identity" },
  });

  const res = new Response("plain text");
  const result = edgeCompressor.compress(req, res);

  assertEquals(result.headers.has("Content-Encoding"), false);
});
