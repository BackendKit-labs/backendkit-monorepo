import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, Err, StepResult } from '@backendkit-labs/pipeline';
import { MetricsService, LoggerService } from '@backendkit-labs/observability';
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import { HttpClient } from '@backendkit-labs/http-client';
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
    const result = await this.client.post<{ transactionId: string; status: string; amount: number }>(
      '/charge',
      {
        orderId: ctx.orderId,
        amount: ctx.totalAmount,
        method: ctx.paymentMethod,
      },
    );

    if (!result.ok) {
      const reason = result.error.message ?? 'Payment gateway error';
      this.logger.error(`Payment failed: orderId=${ctx.orderId} reason=${reason}`, 'ChargePaymentStep');
      this.metrics.record('payment.failed', 1);
      return Err({ kind: 'payment-failed', reason });
    }

    const transactionId = result.value.data.transactionId;
    this.metrics.record('payment.charged', ctx.totalAmount, { unit: 'cents' });
    this.logger.log(
      `Payment charged: orderId=${ctx.orderId} transactionId=${transactionId}`,
      'ChargePaymentStep',
    );

    return Ok({ ...ctx, transactionId });
  }
}
