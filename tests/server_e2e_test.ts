/**
 * E2E HTTP Integration Tests for GLASTOR® Medusa Kernel Server.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { extractClientIp, handler } from "../src/server.ts";

Deno.test("Server E2E - handles CORS preflight OPTIONS request", async () => {
  const req = new Request("http://localhost:8000/v1/currency/convert", {
    method: "OPTIONS",
  });
  const res = await handler(req);

  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(res.headers.has("Access-Control-Allow-Methods"), true);
});

Deno.test("Server E2E - handles /livez liveness probe with 200 UP", async () => {
  const req = new Request("http://localhost:8000/livez");
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-glastor-status"), "UP");
  const data = await res.json();
  assertEquals(data.status, "UP");
  assertEquals(typeof data.uptimeSeconds, "number");
});

Deno.test("Server E2E - handles /readyz readiness probe with 200 READY", async () => {
  const req = new Request("http://localhost:8000/readyz");
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-glastor-status"), "READY");
  const data = await res.json();
  assertEquals(data.ready, true);
});

Deno.test("Server E2E - handles /health telemetry endpoint with 200 HEALTHY", async () => {
  const req = new Request("http://localhost:8000/health");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.glastor, "Medusa Resilient Gateway");
  assertEquals(data.status, "HEALTHY");
  assertEquals(Array.isArray(data.circuitBreakers), true);
});

Deno.test("Server E2E - serves OpenAPI 3.1 self-describing contract with synchronized version 0.2.1", async () => {
  const req = new Request("http://localhost:8000/openapi.json");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const spec = await res.json();
  assertEquals(spec.openapi, "3.1.0");
  assertEquals(spec.info.version, "0.2.1");
  assertEquals(Boolean(spec.paths["/livez"]), true);
  assertEquals(Boolean(spec.paths["/readyz"]), true);
  assertEquals(Boolean(spec.paths["/v1/currency/convert"]), true);
});

Deno.test("Server E2E - serves root JSON metadata with version 0.2.1", async () => {
  const req = new Request("http://localhost:8000/");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.glastor, "Medusa APILayer Gateway");
  assertEquals(data.version, "0.2.1");
  assertEquals(data.probes.liveness, "/livez");
});

Deno.test("Server E2E - serves HTML Dashboard when Accept includes text/html", async () => {
  const req = new Request("http://localhost:8000/", {
    headers: { "Accept": "text/html,application/xhtml+xml" },
  });
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type")?.includes("text/html"), true);
  const html = await res.text();
  assertEquals(html.includes("GLASTOR® Medusa"), true);
});

Deno.test("Server E2E - returns 400 Bad Request with Glastor 4R schema on unknown route", async () => {
  const req = new Request("http://localhost:8000/non-existent-route");
  const res = await handler(req);

  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.success, false);
  assertEquals(data.error.code, "GLASTOR_BAD_REQUEST");
  assertEquals(Boolean(data.error.reason), true);
  assertEquals(Boolean(data.error.recovery), true);
  assertEquals(Boolean(data.error.remediation), true);
  assertEquals(Boolean(data.error.requestId), true);
});

Deno.test("Server E2E - rejects unsupported HTTP methods on proxy", async () => {
  const req = new Request("http://localhost:8000/v1/proxy/test", {
    method: "PURGE",
  });
  const res = await handler(req);

  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error.code, "GLASTOR_BAD_REQUEST");
  assertEquals(data.error.message.includes("Unsupported HTTP method"), true);
});

Deno.test("Server E2E - rejects proxy requests exceeding maximum allowed body size", async () => {
  const req = new Request("http://localhost:8000/v1/proxy/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": "2000000", // 2MB exceeds 1MB limit
    },
    body: JSON.stringify({ data: "oversized" }),
  });
  const res = await handler(req);

  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error.message, "Payload Too Large");
});

Deno.test("Server E2E - extracts client IP safely without trusting client-spoofed XFF prefix", () => {
  // Case 1: Cloudflare Connecting IP takes highest precedence
  const req1 = new Request("http://localhost:8000/livez", {
    headers: {
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      "cf-connecting-ip": "203.0.113.195",
    },
  });
  assertEquals(extractClientIp(req1), "203.0.113.195");

  // Case 2: X-Real-IP takes precedence over XFF
  const req2 = new Request("http://localhost:8000/livez", {
    headers: {
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
      "x-real-ip": "198.51.100.50",
    },
  });
  assertEquals(extractClientIp(req2), "198.51.100.50");

  // Case 3: XFF chain takes rightmost (last hop) IP, not leftmost spoofed IP
  const req3 = new Request("http://localhost:8000/livez", {
    headers: {
      "x-forwarded-for": "spoofed.ip.address, 192.0.2.1",
    },
  });
  assertEquals(extractClientIp(req3), "192.0.2.1");
});
