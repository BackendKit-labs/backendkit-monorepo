import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, Err, StepResult } from '@backendkit-labs/pipeline';
import { MetricsService, LoggerService } from '@backendkit-labs/observability';
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import { HttpClient } from '@backendkit-labs/http-client';
import { again } from '@backendkit-labs/again';
import { PAYMENT_CLIENT } from '../../../infrastructure/http-clients/tokens';
import { OrderContext, OrderError } from './order-pipeline.context';

@Injectable()
export class ChargePaymentStep implements PipelineStep<OrderContext, OrderError> {
  readonly stepName = 'charge-payment';

  constructor(
    @InjectHttpClient(PAYMENT_CLIENT) private readonly client: HttpClient,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
  ) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    const result = await again(
      async () => {
        const r = await this.client.post<{ transactionId: string; status: string; amount: number }>(
          '/charge',
          { orderId: ctx.orderId, amount: ctx.totalAmount, method: ctx.paymentMethod },
        );
        if (!r.ok) {
          throw Object.assign(
            new Error(r.error.message ?? 'Payment gateway error'),
            { status: r.error.status ?? 503 },
          );
        }
        return r.value.data;
      },
      {
        maxAttempts: 3,
        backoff: { type: 'exponential', baseDelay: 150, maxDelay: 2_000, jitter: 'full' },
        retryIf: { shouldRetry: (e) => e.type === 'http' && (e.status === 503 || e.status === 500) },
        hooks: {
          beforeRetry: ({ attempt, delayMs }) => {
            this.logger.warn(
              `Payment retry: orderId=${ctx.orderId} attempt=${attempt} delayMs=${Math.round(delayMs)}ms`,
              'ChargePaymentStep',
            );
            this.metrics.record('payment.retry', 1, { tags: { attempt: String(attempt) } });
          },
        },
      },
    );

    if (!result.ok) {
      const reason = result.error.message ?? 'Payment gateway error';
      const attempts = result.error.metadata.attempts;
      this.logger.error(
        `Payment failed after ${attempts} attempts: orderId=${ctx.orderId} reason=${reason}`,
        'ChargePaymentStep',
      );
      this.metrics.record('payment.failed', 1);
      return Err({ kind: 'payment-failed', reason });
    }

    const { transactionId } = result.value;
    this.metrics.record('payment.charged', ctx.totalAmount, { unit: 'cents' });
    this.logger.log(
      `Payment charged: orderId=${ctx.orderId} transactionId=${transactionId}`,
      'ChargePaymentStep',
    );

    return Ok({ ...ctx, transactionId });
  }
}
