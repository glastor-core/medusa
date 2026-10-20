/**
 * GLASTOR® Medusa - Deno.cron Cache Pre-warming Engine
 * Proactively refreshes high-traffic endpoints in the background to ensure sub-millisecond cache hits.
 */

import { apilayerClient } from "../services/apilayer_client.ts";
import { config } from "../config.ts";

export interface PrewarmMetrics {
  enabled: boolean;
  totalRuns: number;
  lastRunTime: string | null;
  lastDurationMs: number;
  lastStatus: "SUCCESS" | "FAILED" | "IDLE";
  prewarmedItems: string[];
}

export class PrewarmEngine {
  private totalRuns = 0;
  private lastRunTime: number | null = null;
  private lastDurationMs = 0;
  private lastStatus: "SUCCESS" | "FAILED" | "IDLE" = "IDLE";
  private isRunning = false;
  private prewarmedItems: string[] = [
    "currency_latest:base=USD&symbols=EUR,GBP,JPY",
    "currency_latest:base=EUR&symbols=USD,GBP,JPY",
  ];

  init(): void {
    // Check if Deno.cron is supported in current runtime (native in Deno Deploy & Deno 2)
    const cronFn = (Deno as unknown as {
      cron?: (name: string, schedule: string, handler: () => Promise<void>) => void;
    }).cron;

    if (typeof cronFn === "function" && config.apilayerApiKey) {
      console.log(
        "⚡ [Glastor-Prewarm] Registering Deno.cron schedule: '*/10 * * * *' (Every 10 minutes)",
      );
      cronFn("Medusa Cache Prewarm", "*/10 * * * *", async () => {
        await this.runNow();
      });
    } else {
      console.log(
        "⚡ [Glastor-Prewarm] Background pre-warming engine initialized (on-demand or cron ready)",
      );
    }
  }

  async runNow(): Promise<boolean> {
    if (this.isRunning) {
      console.warn("[Glastor-Prewarm] Prewarm cycle already running, skipping overlapping run.");
      return false;
    }

    if (!config.apilayerApiKey) {
      this.lastStatus = "IDLE";
      return false;
    }

    this.isRunning = true;
    const start = performance.now();
    console.log("⚡ [Glastor-Prewarm] Starting background cache pre-warm cycle...");

    try {
      // 1. Prewarm USD exchange rates
      await apilayerClient.request({
        service: "currency_latest",
        path: "/exchangerates_data/latest",
        params: { base: "USD", symbols: "EUR,GBP,JPY" },
        ttlSeconds: 900, // 15 minutes
        skipCache: true, // Force fresh upstream fetch to prime cache
        requestId: `prewarm-${crypto.randomUUID()}`,
      });

      // 2. Prewarm EUR exchange rates
      await apilayerClient.request({
        service: "currency_latest",
        path: "/exchangerates_data/latest",
        params: { base: "EUR", symbols: "USD,GBP,JPY" },
        ttlSeconds: 900,
        skipCache: true,
        requestId: `prewarm-${crypto.randomUUID()}`,
      });

      this.lastStatus = "SUCCESS";
      this.totalRuns++;
      this.lastRunTime = Date.now();
      this.lastDurationMs = Math.round(performance.now() - start);
      console.log(`✅ [Glastor-Prewarm] Finished successfully in ${this.lastDurationMs}ms`);
      return true;
    } catch (err) {
      this.lastStatus = "FAILED";
      this.lastRunTime = Date.now();
      this.lastDurationMs = Math.round(performance.now() - start);
      console.error("[Glastor-Prewarm] Prewarm run encountered an error:", err);
      return false;
    } finally {
      this.isRunning = false;
    }
  }

  getMetrics(): PrewarmMetrics {
    return {
      enabled: Boolean(config.apilayerApiKey),
      totalRuns: this.totalRuns,
      lastRunTime: this.lastRunTime ? new Date(this.lastRunTime).toISOString() : null,
      lastDurationMs: this.lastDurationMs,
      lastStatus: this.lastStatus,
      prewarmedItems: [...this.prewarmedItems],
    };
  }
}

export const prewarmEngine = new PrewarmEngine();
