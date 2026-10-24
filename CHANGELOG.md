# Changelog

All notable changes to **GLASTOR® Medusa** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and
[Conventional Commits](https://www.conventionalcommits.org/).

---

## [Unreleased]

---

## [0.2.1] - 2026-10-24

### Security & Concurrency Hardening

- **Single-Flight Concurrency Isolation**: Restricted Single-Flight coalescing strictly to safe,
  idempotent requests (`GET`, `HEAD`) in `src/services/apilayer_client.ts`. Mutating requests
  (`POST`, `PUT`, `DELETE`, `PATCH`) execute directly to prevent cross-client body collision and
  data leakage.
- **Strict HTTP Idempotency Retries**: Configured `fetchWithRetry` to disallow automatic 5xx retries
  for non-idempotent methods (`maxRetries = 0`), adhering to RFC 9110 and eliminating upstream
  duplicate mutations.
- **Fail-Closed Production Authentication**: Enforced strict perimeter authentication. In production
  or when `authRequired` is enabled, a missing `MEDUSA_API_KEY` returns a fatal
  `500 GLASTOR_GATEWAY_MISCONFIGURATION` rather than leaving routes silently open to anonymous
  traffic.
- **Client IP Extraction & Spoofing Defense**: Hardened `extractClientIp` in `src/server.ts` to
  prioritize `cf-connecting-ip` and `x-real-ip`, and select the rightmost (last hop) IP from
  `x-forwarded-for` to eliminate rate limit evasion via client-forged headers (CWE-290).
- **Credential-Aware Rate Quotas**: Enhanced `RateLimiter` identifier resolution to prioritize
  client API keys (`key:<token>`) over raw IP (`ip:<clientIp>`), preventing abuse through IP
  rotation.
- **Protected Telemetry Exposure**: Hardened `/health` endpoint to serve a minimal sanitized status
  to unauthenticated callers while restricting internal V8 memory, cache metrics, and config
  thresholds to authorized operators.
- **Universal Proxy Guardrails**: Added strict HTTP method whitelist (`ALLOWED_PROXY_METHODS`),
  clamped custom `x-medusa-ttl` to 86,400s (24h max), and enforced a 1MB payload ceiling
  (`MAX_BODY_SIZE_BYTES`).

### CI/CD & Operations

- **Modern Deno Deploy Automation**: Modernized `.github/workflows/deploy.yml` with
  `jsr:@deno/deployctl` and updated documentation to `console.deno.com`.
- **Eliminated Silent Deployment Failures**: Removed `continue-on-error: true` and added pre-deploy
  quality gates (`deno check`, `deno test`).
- **Verifiable Dynamic CI Badge**: Replaced static badge in `README.md` with dynamic GitHub Actions
  workflow status indicator.
- **Version Alignment**: Synchronized `0.2.0` / `0.2.1` across `deno.json`, `config.ts`,
  `server.ts`, `/health`, and OpenAPI 3.1 contract.

### Added

- **Structured Edge Logger**: High-performance JSON logger (`src/core/logger.ts`) with trace
  correlation (`requestId`, `service`, `latencyMs`), ISO-8601 timestamps, and log level filtering
  (`DEBUG`, `INFO`, `WARN`, `ERROR`).
- **Bounded LRU Cache Eviction**: Integrated bounded LRU eviction in L1 memory cache
  (`EdgeCache.setL1Entry`) with configurable `maxL1Entries` (default 1,000) and `evictions`
  telemetry to eliminate unbounded memory growth in edge isolates.
- **Orchestration Probes Separation**:
  - Implemented `/livez` liveness probe returning strictly HTTP 200 OK while the event loop is
    active, eliminating container crash loops in Kubernetes and Cloud Run.
  - Implemented `/readyz` readiness probe evaluating circuit breaker health and dependency readiness
    (HTTP 200 or 503).
- **Atomic RateLimiter Retries**: Added optimistic lock retry loop with micro-jitter (1-3ms) on Deno
  KV atomic transaction conflicts to maintain cross-edge rate limit consistency under heavy
  concurrent traffic.
- **Enhanced OpenAPI 3.1 Contract**: Extended `/openapi.json` with security schemes (`MedusaApiKey`,
  `BearerAuth`), probes (`/livez`, `/readyz`), error schemas (`GlastorError4R`), and full route
  coverage.
- **End-to-End HTTP Integration Test Suite**: Implemented `tests/server_e2e_test.ts` validating CORS
  preflight, probe routing, error formatting, and HTML dashboard rendering.

### Security

- **Stack Trace & CWE-209 Information Shielding**: Restricted internal error details and runtime
  stack traces in `GlastorError.internal` strictly to development environments.
- **Automated Secret Redaction in Logger**: Added recursive masking for `apiKey`, `bearer`, `token`,
  and `password` fields across all log entries.
- **Upstream Key Leakage Prevention**: Filtered client `apikey` query parameters from `/v1/proxy/*`
  and sanitized upstream error response bodies to prevent credential reflection.
- **Hardened Git Exclusions**: Broadened `.gitignore` to reject all environment variants,
  certificates, private keys, and credential stores.

---

## [0.1.0] - 2026-10-22

### Added

- **Zero-Trust Perimeter Validation**: Integrated Valibot (`jsr:@valibot/valibot`) for declarative,
  tree-shakeable schema enforcement on all edge inputs (`/v1/currency`, `/v1/email-verify`,
  `/v1/ip-geo`).
- **Native Stream Compression**: Implemented Web Streams `CompressionStream` (`gzip` and `deflate`)
  with client content-encoding negotiation and streaming bypass for small payloads.
- **Single-Flight Request Deduplication**: Prevents cache stampede and thundering herd concurrency
  spikes by coalescing concurrent upstream requests into a single promise
  (`x-glastor-single-flight: COALESCED`).
- **Proactive Deno.cron Pre-warming**: Automated serverless background cron running every 10 minutes
  (`*/10 * * * *`) refreshing primary currency pairs to guarantee sub-millisecond edge cache hits.
- **Multi-Tier Edge Cache**: Dual-layer architecture featuring L1 in-memory acceleration and L2 Deno
  KV distributed persistence with Stale-While-Revalidate (SWR) fallback.
- **Autonomous Circuit Breaker**: State-machine engine (CLOSED / OPEN / HALF_OPEN) per upstream
  service with configurable thresholds, exponential backoff, and fast-fail protection.
- **Distributed Rate Limiting**: Token-bucket sliding window rate limiter backed by Deno KV atomic
  transactions with standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`).
- **Core 4R Observability**: Standardized error responses adhering to the Glastor Standard (`code`,
  `reason`, `recovery`, `remediation`, and `requestId`).
- **Interactive Glassmorphic Edge Console**: Live dashboard at `/` featuring dark-mode aesthetic,
  telemetry status, real-time query runner, and latency benchmarking.
- **Universal APILayer Proxy**: Resilient pass-through endpoint (`/v1/proxy/*`) supporting any
  APILayer service with dynamic TTL and cache-bypass controls.
- **OpenAPI 3.1 Specification**: Contract endpoint at `/openapi.json` documenting gateway routes,
  parameters, and telemetry contracts.
- **GitHub 2026 Elite Standards**: 100/100 compliance audit with `@glastor-dev/samurai`, including
  Scorecard, CodeQL, Least Privilege GitHub Actions, Dependabot groups, and Lefthook hooks.

### Security

- Perimeter token authentication via `x-medusa-key` and `Authorization: Bearer`.
- Private Vulnerability Reporting (PVR) and security response SLA defined in
  [SECURITY.md](SECURITY.md).
- Automated SAST analysis via GitHub CodeQL and OSSF Scorecard in CI/CD pipeline.

[Unreleased]: https://github.com/glastor-core/medusa/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/glastor-core/medusa/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/glastor-core/medusa/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/glastor-core/medusa/releases/tag/v0.1.0
