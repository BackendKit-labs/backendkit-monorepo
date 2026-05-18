import { Injectable, Inject } from '@nestjs/common';
import { CircuitBreakerService } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadService } from '@backendkit-labs/bulkhead/nestjs';
import { LoggerService } from '@backendkit-labs/observability';
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import { HttpClient } from '@backendkit-labs/http-client';
import { AUTO_LEARNING_INSTANCE } from '@backendkit-labs/auto-learning/nestjs';
import { AutoLearningCore } from '@backendkit-labs/auto-learning';
import { PAYMENT_CLIENT } from '../../infrastructure/http-clients/tokens';

@Injectable()
export class HealthService {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
    private readonly logger: LoggerService,
    @Inject(AUTO_LEARNING_INSTANCE)
    private readonly autoLearning: AutoLearningCore,
    @InjectHttpClient(PAYMENT_CLIENT)
    private readonly paymentClient: HttpClient,
  ) {}

  getHealth() {
    const cbMetrics = this.getCircuitBreakerMetrics();
    const bhMetrics = this.getBulkheadMetrics();

    const hasOpenCircuit = Object.values(cbMetrics).some((m: any) => m.state === 'open');

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
    const metrics: Record<string, unknown> = { ...this.circuitBreakerService.getAllMetrics() };
    const paymentCb = this.paymentClient.getCircuitBreakerMetrics();
    if (paymentCb) metrics['payment-gateway'] = paymentCb;
    return metrics;
  }

  getBulkheadMetrics() {
    try {
      return (this.bulkheadService as any).getAllMetrics?.() ?? {};
    } catch {
      return {};
    }
  }

  getAutoLearningState() {
    const statsResult = this.autoLearning.patternRegistry.getStats();
    const patternStats = statsResult.ok ? statsResult.value : null;
    return {
      running: this.autoLearning.isFeedbackLoopRunning(),
      currentConfig: this.autoLearning.getCurrentConfig(),
      patternStats,
    };
  }
}
