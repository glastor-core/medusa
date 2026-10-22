/**
 * GLASTOR® Medusa - Resilient Circuit Breaker
 * Protects downstream consumers and preserves APILayer monthly quotas during outages.
 */

import { logger } from "./logger.ts";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxProbes?: number;
}

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  failures: number;
  consecutiveFailures: number;
  successes: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  totalExecutions: number;
  totalRejections: number;
  openedAt: string | null;
  resetTimeoutRemainingMs: number;
}

export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = "CLOSED";
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private halfOpenMaxProbes: number;

  private consecutiveFailures = 0;
  private failures = 0;
  private successes = 0;
  private probeSuccesses = 0;
  private activeProbes = 0;
  private totalExecutions = 0;
  private totalRejections = 0;

  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.halfOpenMaxProbes = options.halfOpenMaxProbes ?? 3;
  }

  getState(): CircuitState {
    this.evaluateState();
    return this.state;
  }

  private evaluateState(): void {
    if (this.state === "OPEN" && this.openedAt) {
      const now = Date.now();
      if (now - this.openedAt >= this.resetTimeoutMs) {
        this.transitionTo("HALF_OPEN");
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === "OPEN") {
      this.openedAt = Date.now();
      this.probeSuccesses = 0;
      this.activeProbes = 0;
    } else if (newState === "HALF_OPEN") {
      this.probeSuccesses = 0;
      this.activeProbes = 0;
    } else if (newState === "CLOSED") {
      this.consecutiveFailures = 0;
      this.openedAt = null;
      this.probeSuccesses = 0;
      this.activeProbes = 0;
    }

    if (oldState !== newState) {
      logger.warn(
        `[Glastor-CircuitBreaker][${this.name}] State transition: ${oldState} -> ${newState}`,
        { service: this.name, oldState, newState },
      );
    }
  }

  canExecute(): boolean {
    this.evaluateState();
    if (this.state === "OPEN") {
      this.totalRejections++;
      return false;
    }
    if (this.state === "HALF_OPEN") {
      if (this.activeProbes >= this.halfOpenMaxProbes) {
        this.totalRejections++;
        return false;
      }
      this.activeProbes++;
      return true;
    }
    return true;
  }

  recordSuccess(): void {
    const now = Date.now();
    this.successes++;
    this.totalExecutions++;
    this.lastSuccessTime = now;

    if (this.state === "HALF_OPEN") {
      this.probeSuccesses++;
      if (this.probeSuccesses >= this.halfOpenMaxProbes) {
        this.transitionTo("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      this.consecutiveFailures = 0;
    }
  }

  recordFailure(): void {
    const now = Date.now();
    this.failures++;
    this.totalExecutions++;
    this.consecutiveFailures++;
    this.lastFailureTime = now;

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED") {
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.transitionTo("OPEN");
      }
    }
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      if (fallback) {
        return await fallback();
      }
      const remainingMs = this.openedAt
        ? Math.max(0, this.resetTimeoutMs - (Date.now() - this.openedAt))
        : this.resetTimeoutMs;
      throw new Error(
        `CircuitBreaker[${this.name}] is OPEN. Fast-fail active. Reset in ${remainingMs}ms.`,
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      if (fallback) {
        return await fallback();
      }
      throw err;
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    this.evaluateState();
    const remainingMs = (this.state === "OPEN" && this.openedAt)
      ? Math.max(0, this.resetTimeoutMs - (Date.now() - this.openedAt))
      : 0;

    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
      totalExecutions: this.totalExecutions,
      totalRejections: this.totalRejections,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
      resetTimeoutRemainingMs: remainingMs,
    };
  }

  reset(): void {
    this.transitionTo("CLOSED");
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.successes = 0;
    this.totalExecutions = 0;
    this.totalRejections = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
  }
}

// Global registry of circuit breakers by service name
export const circuitBreakerRegistry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let cb = circuitBreakerRegistry.get(name);
  if (!cb) {
    cb = new CircuitBreaker(name, options);
    circuitBreakerRegistry.set(name, cb);
  }
  return cb;
}
