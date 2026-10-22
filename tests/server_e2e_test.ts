/**
 * E2E HTTP Integration Tests for GLASTOR® Medusa Kernel Server.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { handler } from "../src/server.ts";

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

Deno.test("Server E2E - serves OpenAPI 3.1 self-describing contract", async () => {
  const req = new Request("http://localhost:8000/openapi.json");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const spec = await res.json();
  assertEquals(spec.openapi, "3.1.0");
  assertEquals(Boolean(spec.paths["/livez"]), true);
  assertEquals(Boolean(spec.paths["/readyz"]), true);
  assertEquals(Boolean(spec.paths["/v1/currency/convert"]), true);
});

Deno.test("Server E2E - serves root JSON metadata by default", async () => {
  const req = new Request("http://localhost:8000/");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.glastor, "Medusa APILayer Gateway");
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
