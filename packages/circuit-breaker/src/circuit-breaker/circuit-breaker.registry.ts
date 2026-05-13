import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker.js';

export interface CircuitBreakerOptions extends Partial<CircuitBreakerConfig> {
  name: string;
}

export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  getOrCreate(options: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(options.name)) {
      const config: CircuitBreakerConfig = {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        ...options,
        name: options.name,
      };
      this.breakers.set(options.name, new CircuitBreaker(config));
    }
    return this.breakers.get(options.name)!;
  }

  /**
   * For external HTTP calls.
   * Only HTTP 5xx and non-HTTP errors (network, timeout) open the circuit.
   * HTTP 4xx (business errors like 404, 401, 422) pass through transparently.
   */
  getForHttpExternal(serviceName: string): CircuitBreaker {
    return this.getOrCreate({
      name: `http:${serviceName}`,
      failureThreshold: 50,
      minimumCalls: 5,
      openTimeoutMs: 30_000,
      isFailure: isHttpServerError,
    });
  }

  /**
   * For internal service-to-service calls.
   * All errors count — services should not throw business errors at each other.
   */
  getForService(serviceName: string): CircuitBreaker {
    return this.getOrCreate({
      name: `service:${serviceName}`,
      failureThreshold: 50,
      minimumCalls: 5,
      openTimeoutMs: 30_000,
    });
  }

  /**
   * For database operations.
   * All errors count. More sensitive threshold (30%) and shorter timeout.
   */
  getForDatabase(schema: string): CircuitBreaker {
    return this.getOrCreate({
      name: `database:${schema}`,
      failureThreshold: 30,
      minimumCalls: 3,
      slidingWindowSize: 5,
      openTimeoutMs: 15_000,
    });
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, cb] of this.breakers) {
      metrics[name] = cb.getMetrics();
    }
    return metrics;
  }

  getOpenBreakers(): CircuitBreakerMetrics[] {
    return [...this.breakers.values()]
      .map(cb => cb.getMetrics())
      .filter(m => m.state !== CircuitBreakerState.CLOSED);
  }

  reset(name: string): void {
    this.breakers.get(name)?.reset();
  }

  resetAll(): void {
    for (const cb of this.breakers.values()) cb.reset();
  }
}

/**
 * Counts only HTTP 5xx and non-HTTP errors as infrastructure failures.
 * HTTP 4xx (404, 401, 403, 422…) are business errors — transparent to the circuit.
 *
 * Works with NestJS HttpException and any object with a `getStatus(): number` method.
 */
export function isHttpServerError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Record<string, unknown>)['getStatus'] === 'function'
  ) {
    return (error as { getStatus(): number }).getStatus() >= 500;
  }
  return true;
}
