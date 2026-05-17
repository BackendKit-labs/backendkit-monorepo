import { Injectable } from '@nestjs/common';
import { CircuitBreakerService } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadService } from '@backendkit-labs/bulkhead/nestjs';
import { LoggerService } from '@backendkit-labs/observability';

@Injectable()
export class HealthService {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
    private readonly logger: LoggerService,
  ) {}

  getHealth() {
    const cbMetrics = this.circuitBreakerService.getAllMetrics();
    const bhMetrics = this.getBulkheadMetrics();

    const hasOpenCircuit = Array.isArray(cbMetrics) &&
      cbMetrics.some((m: any) => m.state === 'open');

    const status = hasOpenCircuit ? 'degraded' : 'healthy';

    this.logger.log(`Health check: status=${status}`, 'HealthService');

    return {
      status,
      timestamp: new Date().toISOString(),
      circuitBreakers: cbMetrics,
      bulkheads: bhMetrics,
    };
  }

  getCircuitBreakerMetrics() {
    return this.circuitBreakerService.getAllMetrics();
  }

  getBulkheadMetrics() {
    try {
      return (this.bulkheadService as any).getAllMetrics?.() ?? {};
    } catch {
      return {};
    }
  }
}
