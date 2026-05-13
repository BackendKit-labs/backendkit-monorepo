import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { CircuitBreakerRegistry } from '../circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerMetrics, CircuitBreakerState } from '../circuit-breaker/circuit-breaker.js';

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(CircuitBreakerRegistry) private readonly registry: CircuitBreakerRegistry) {
    this.startMonitoring();
  }

  onModuleDestroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    return this.registry.getAllMetrics();
  }

  getOpenBreakers(): CircuitBreakerMetrics[] {
    return this.registry.getOpenBreakers();
  }

  reset(name: string): void {
    this.registry.reset(name);
  }

  resetAll(): void {
    this.registry.resetAll();
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      const open = this.getOpenBreakers();
      if (open.length === 0) return;

      const openCircuits  = open.filter(m => m.state === CircuitBreakerState.OPEN);
      const halfOpenCircuits = open.filter(m => m.state === CircuitBreakerState.HALF_OPEN);

      if (openCircuits.length > 0) {
        this.logger.warn(
          `OPEN circuit breakers: ${openCircuits.length}`,
          openCircuits.map(m => ({
            name:        m.name,
            failureRate: `${m.failureRate}%`,
            notPermitted: m.notPermittedCalls,
          })),
        );
      }
      if (halfOpenCircuits.length > 0) {
        this.logger.log(
          `HALF_OPEN circuit breakers probing: ${halfOpenCircuits.map(m => m.name).join(', ')}`,
        );
      }
    }, 60_000);
  }
}
