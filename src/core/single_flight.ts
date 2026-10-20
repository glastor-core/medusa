/**
 * GLASTOR® Medusa - Single-Flight Request Deduplication Engine
 * Suppresses duplicate concurrent upstream calls to eliminate cache stampedes / thundering herds.
 */

export interface SingleFlightMetrics {
  activeFlights: number;
  totalCalls: number;
  deduplicatedCalls: number;
}

export class SingleFlightGroup {
  private inFlight = new Map<string, Promise<unknown>>();
  private totalCalls = 0;
  private deduplicatedCalls = 0;

  /**
   * Executes the given async function `fn` under `key`.
   * If another call with the same `key` is currently pending, it awaits that call
   * instead of invoking `fn` again.
   */
  async do<T>(key: string, fn: () => Promise<T>): Promise<{ data: T; shared: boolean }> {
    this.totalCalls++;

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      this.deduplicatedCalls++;
      const data = await existing;
      return { data, shared: true };
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);

    const data = await promise;
    return { data, shared: false };
  }

  getMetrics(): SingleFlightMetrics {
    return {
      activeFlights: this.inFlight.size,
      totalCalls: this.totalCalls,
      deduplicatedCalls: this.deduplicatedCalls,
    };
  }

  reset(): void {
    this.inFlight.clear();
    this.totalCalls = 0;
    this.deduplicatedCalls = 0;
  }
}

export const singleFlight = new SingleFlightGroup();
