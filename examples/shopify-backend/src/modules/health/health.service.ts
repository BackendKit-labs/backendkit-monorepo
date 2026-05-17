import { Injectable, Inject } from '@nestjs/common';
import { CircuitBreakerService } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadService } from '@backendkit-labs/bulkhead/nestjs';
import { LoggerService } from '@backendkit-labs/observability';
import { AUTO_LEARNING_INSTANCE } from '@backendkit-labs/auto-learning/nestjs';
import { AutoLearningCore } from '@backendkit-labs/auto-learning';

@Injectable()
export class HealthService {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
    private readonly logger: LoggerService,
    @Inject(AUTO_LEARNING_INSTANCE)
    private readonly autoLearning: AutoLearningCore,
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

  getAutoLearningState() {
    return {
      running: this.autoLearning.isFeedbackLoopRunning(),
      currentConfig: this.autoLearning.getCurrentConfig(),
    };
  }
}
