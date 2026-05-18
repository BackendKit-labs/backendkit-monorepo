import { Injectable, Inject } from '@nestjs/common';
import { SpanStatusCode, trace }  from '@opentelemetry/api';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { BulkheadRegistry }       from '@backendkit-labs/bulkhead';
import { AUTO_LEARNING_INSTANCE } from '@backendkit-labs/auto-learning/nestjs';
import { AutoLearningCore }       from '@backendkit-labs/auto-learning';
import { LoggerService }          from '@backendkit-labs/observability';

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL ?? 'https://httpbin.org/delay/1';

@Injectable()
export class DemoService {
  private readonly tracer = trace.getTracer('demo-service');

  private readonly cb = this.cbRegistry.getForHttpExternal('httpbin');
  private readonly bh = this.bhRegistry.getOrCreate({ name: 'httpbin', maxConcurrentCalls: 5 });

  constructor(
    @Inject(CircuitBreakerRegistry) private readonly cbRegistry: CircuitBreakerRegistry,
    @Inject(BulkheadRegistry)       private readonly bhRegistry: BulkheadRegistry,
    private readonly logger: LoggerService,
    @Inject(AUTO_LEARNING_INSTANCE)
    private readonly al: AutoLearningCore,
  ) {}

  async callExternalApi(): Promise<{ status: string; data: unknown }> {
    return this.tracer.startActiveSpan('demo.callExternalApi', async (span) => {
      try {
        const data = await this.bh.execute(() =>
          this.cb.execute(async () => {
            const res = await fetch(EXTERNAL_API_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<unknown>;
          }),
        );
        span.setStatus({ code: SpanStatusCode.OK });
        return { status: 'ok', data };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  getStatus() {
    const cbMetrics = this.cb.getMetrics();
    const bhMetrics = this.bh.getMetrics();
    const alState   = {
      running:       this.al.isFeedbackLoopRunning(),
      currentConfig: this.al.getCurrentConfig(),
    };
    this.logger.log('Status checked', 'DemoService');
    return { circuitBreaker: cbMetrics, bulkhead: bhMetrics, autoLearning: alState };
  }
}
