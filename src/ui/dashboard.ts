/**
 * GLASTOR® Medusa - Glassmorphic Edge Console & Dashboard
 * Ultra-high aesthetic live interface for testing and monitoring Medusa Gateway on Deno Deploy.
 */

export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GLASTOR® Medusa — Resilient APILayer Edge Gateway</title>
  <meta name="description" content="High-performance resilient API gateway, circuit breaker, and Deno KV caching proxy for APILayer on Deno Deploy.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #090d16;
      --bg-surface: rgba(18, 24, 38, 0.7);
      --bg-card: rgba(23, 31, 51, 0.6);
      --bg-card-hover: rgba(30, 41, 69, 0.8);
      --border-color: rgba(99, 102, 241, 0.15);
      --border-glow: rgba(99, 102, 241, 0.4);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent-primary: #6366f1;
      --accent-secondary: #06b6d4;
      --accent-gradient: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
      --status-success: #10b981;
      --status-warning: #f59e0b;
      --status-danger: #ef4444;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 45%);
      background-attachment: fixed;
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* Header */
    header {
      backdrop-filter: blur(16px);
      background: rgba(9, 13, 22, 0.8);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.2rem;
      color: #fff;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.5);
    }

    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .badge-edge {
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-secondary);
      border: 1px solid rgba(6, 182, 212, 0.3);
      font-weight: 600;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .nav-btn {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.5rem 0.85rem;
      border-radius: 8px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .nav-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      font-size: 0.8rem;
      color: var(--status-success);
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--status-success);
      box-shadow: 0 0 8px var(--status-success);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }

    /* Main Container */
    main {
      flex: 1;
      max-width: 1300px;
      width: 100%;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    /* Hero Section */
    .hero {
      text-align: center;
      max-width: 800px;
      margin: 0 auto 1rem auto;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 1rem;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid var(--border-color);
      font-size: 0.825rem;
      color: #a5b4fc;
      margin-bottom: 1.25rem;
    }

    .hero h1 {
      font-size: 2.75rem;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
    }

    .hero h1 span {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero p {
      font-size: 1.125rem;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* Stats Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }

    .metric-card {
      background: var(--bg-surface);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent-gradient);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .metric-card:hover {
      border-color: var(--border-glow);
      transform: translateY(-2px);
    }

    .metric-card:hover::before {
      opacity: 1;
    }

    .metric-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .metric-value {
      font-size: 1.85rem;
      font-weight: 700;
      color: var(--text-main);
      font-family: var(--font-mono);
    }

    .metric-detail {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
    }

    /* Two Columns Section: Console & Features */
    .split-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.75rem;
    }

    @media (max-width: 960px) {
      .split-layout {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      background: var(--bg-surface);
      backdrop-filter: blur(14px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 1rem;
    }

    .panel-title {
      font-size: 1.2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    /* Live Tester Form */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    select, input {
      background: rgba(12, 17, 29, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      color: var(--text-main);
      font-family: var(--font-mono);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      width: 100%;
    }

    select:focus, input:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .btn-submit {
      background: var(--accent-gradient);
      color: #fff;
      font-family: var(--font-sans);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.85rem 1.5rem;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
    }

    .btn-submit:hover {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
      transform: translateY(-1px);
    }

    .btn-submit:active {
      transform: translateY(0);
    }

    /* Response Viewer */
    .response-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .pill {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-weight: 600;
    }

    .pill-status {
      background: rgba(16, 185, 129, 0.15);
      color: var(--status-success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .pill-cache {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .pill-latency {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-secondary);
      border: 1px solid rgba(6, 182, 212, 0.3);
    }

    .response-box {
      background: #060911;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 1.25rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: #cbd5e1;
      max-height: 380px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Architecture Features List */
    .feature-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      transition: background 0.2s ease;
    }

    .feature-item:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .feature-icon {
      font-size: 1.25rem;
      line-height: 1;
      margin-top: 0.1rem;
    }

    .feature-text h4 {
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 0.2rem;
      color: var(--text-main);
    }

    .feature-text p {
      font-size: 0.825rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    footer {
      border-top: 1px solid var(--border-color);
      padding: 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: auto;
      backdrop-filter: blur(10px);
      background: rgba(9, 13, 22, 0.6);
    }

    footer a {
      color: var(--accent-secondary);
      text-decoration: none;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="logo-icon">M</div>
      <div>
        <div class="brand-title">GLASTOR® Medusa</div>
      </div>
      <span class="badge-edge">Deno Deploy Edge</span>
    </div>

    <div class="nav-actions">
      <div class="status-pill" id="health-pill">
        <span class="status-dot"></span>
        <span id="health-label">HEALTHY</span>
      </div>
      <a href="/openapi.json" target="_blank" class="nav-btn" id="nav-openapi">
        <span>OpenAPI 3.1</span>
      </a>
      <a href="/health" target="_blank" class="nav-btn" id="nav-health">
        <span>Telemetry</span>
      </a>
      <a href="https://github.com/glastor-core" target="_blank" class="nav-btn" id="nav-github">
        <span>GitHub</span>
      </a>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="hero-badge">⚡ Resilient APILayer Ingress & Caching Kernel</div>
      <h1>Protected & Scaled at <span>The Edge</span></h1>
      <p>Eliminate APILayer quota exhaustion, protect downstream consumers with circuit breakers, and achieve sub-millisecond responses via globally distributed Deno KV caching.</p>
    </section>

    <!-- Metrics Strip -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">Circuit Breaker</div>
        <div class="metric-value" style="color: var(--status-success)" id="m-circuit">CLOSED</div>
        <div class="metric-detail">Fail-safe active &middot; 0 Trips</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Edge Cache Tier</div>
        <div class="metric-value" style="color: var(--accent-secondary)" id="m-cache">L1/L2 Active</div>
        <div class="metric-detail">Deno KV + In-Memory &middot; SWR Grace</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Rate Limiting</div>
        <div class="metric-value" style="color: #a5b4fc">60 req/min</div>
        <div class="metric-detail">Distributed Sliding Window</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Observability</div>
        <div class="metric-value" style="color: #38bdf8">Core 4R</div>
        <div class="metric-detail">Reason, Recovery, Remediation, ReqID</div>
      </div>
    </div>

    <!-- Live Gateway Console & Architecture -->
    <div class="split-layout">
      <!-- Left Panel: Interactive Edge Tester -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <span>🧪</span> Live Edge Request Console
          </div>
          <span class="badge-edge">Zero-Trust Gateway</span>
        </div>

        <form id="tester-form">
          <div class="form-group" style="margin-bottom: 0.75rem;">
            <label for="endpoint-select">Select Endpoint</label>
            <select id="endpoint-select">
              <option value="/v1/currency/latest?base=USD&symbols=EUR,GBP,JPY">Currency: Latest Rates (/v1/currency/latest)</option>
              <option value="/v1/currency/convert?from=USD&to=EUR&amount=100">Currency: Convert USD to EUR (/v1/currency/convert)</option>
              <option value="/v1/ip-geo/lookup?ip=8.8.8.8">GeoIP: IP Geolocation Lookup (/v1/ip-geo/lookup)</option>
              <option value="/v1/email-verify/check?email=test@glastor.org">Email: Syntax & MX Verification (/v1/email-verify/check)</option>
              <option value="/health">Telemetry: Gateway Health & Metrics (/health)</option>
              <option value="/openapi.json">Contract: OpenAPI 3.1 Spec (/openapi.json)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label for="path-input">Request Path</label>
            <input type="text" id="path-input" value="/v1/currency/latest?base=USD&symbols=EUR,GBP,JPY" />
          </div>

          <button type="submit" class="btn-submit" id="btn-execute">
            <span>⚡ Send Request to Gateway</span>
          </button>
        </form>

        <div class="response-header">
          <label>Edge Response</label>
          <div style="display: flex; gap: 0.4rem;">
            <span class="pill pill-status" id="res-status">Status: 200 OK</span>
            <span class="pill pill-cache" id="res-cache">Cache: MISS</span>
            <span class="pill pill-latency" id="res-latency">Latency: -- ms</span>
          </div>
        </div>

        <div class="response-box" id="response-output">// Click "Send Request to Gateway" to inspect the live edge response...</div>
      </div>

      <!-- Right Panel: Glastor Core Architectural Pillars -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <span>🏛️</span> Glastor Architectural Pillars
          </div>
          <span class="badge-edge">glastor-core</span>
        </div>

        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon">🛡️</div>
            <div class="feature-text">
              <h4>Circuit Breaker Pattern</h4>
              <p>Monitors upstream APILayer failure rate and automatically trips to fast-fail in microseconds, preventing quota burn and server lockups during provider outages.</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">⚡</div>
            <div class="feature-text">
              <h4>Deno KV Edge Caching & SWR</h4>
              <p>Multi-tiered caching with Stale-While-Revalidate grace period. Even if APILayer goes offline or runs out of credits, Medusa serves resilient cached data seamlessly.</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">🔍</div>
            <div class="feature-text">
              <h4>Core 4R Observability</h4>
              <p>Every response and failure follows Glastor's 4R schema: Reason, Recovery, Remediation, and RequestId for trace correlation in distributed architectures.</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">🔒</div>
            <div class="feature-text">
              <h4>Perimeter Secret Cloaking</h4>
              <p>Downstream clients never touch your APILayer API keys. All credentials remain encrypted and injected securely in Deno Deploy's runtime environment.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <p>GLASTOR® Medusa &middot; Engineered for <a href="https://github.com/glastor-core" target="_blank">glastor-core</a> &middot; Built on Deno 2 & Deno Deploy</p>
  </footer>

  <script>
    const endpointSelect = document.getElementById('endpoint-select');
    const pathInput = document.getElementById('path-input');
    const form = document.getElementById('tester-form');
    const resOutput = document.getElementById('response-output');
    const resStatus = document.getElementById('res-status');
    const resCache = document.getElementById('res-cache');
    const resLatency = document.getElementById('res-latency');

    endpointSelect.addEventListener('change', (e) => {
      pathInput.value = e.target.value;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const path = pathInput.value.trim();
      resOutput.textContent = "Executing request across Deno Deploy edge kernel...";
      const start = performance.now();

      try {
        const res = await fetch(path);
        const elapsed = Math.round(performance.now() - start);
        const cacheHeader = res.headers.get('x-glastor-cache') || 'BYPASS';
        const latencyHeader = res.headers.get('x-glastor-latency-ms') || elapsed;

        resStatus.textContent = 'Status: ' + res.status + ' ' + (res.ok ? 'OK' : 'FAIL');
        resStatus.style.color = res.ok ? 'var(--status-success)' : 'var(--status-danger)';

        resCache.textContent = 'Cache: ' + cacheHeader;
        resLatency.textContent = 'Latency: ' + latencyHeader + ' ms';

        const json = await res.json();
        resOutput.textContent = JSON.stringify(json, null, 2);
      } catch (err) {
        const elapsed = Math.round(performance.now() - start);
        resStatus.textContent = 'Error: Network Failure';
        resStatus.style.color = 'var(--status-danger)';
        resLatency.textContent = 'Latency: ' + elapsed + ' ms';
        resOutput.textContent = JSON.stringify({ error: String(err) }, null, 2);
      }
    });

    // Auto-fetch health on load
    fetch('/health')
      .then(r => r.json())
      .then(data => {
        if (data.status) {
          document.getElementById('health-label').textContent = data.status;
        }
      })
      .catch(() => {});
  </script>
</body>
</html>`;
}
