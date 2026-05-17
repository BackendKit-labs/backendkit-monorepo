import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, StepResult } from '@backendkit-labs/pipeline';
import { LoggerService } from '@backendkit-labs/observability';
import { OrderContext, OrderError } from './order-pipeline.context';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

@Injectable()
export class NotifyCustomerStep implements PipelineStep<OrderContext, OrderError> {
  readonly name = 'notify-customer';

  constructor(private readonly logger: LoggerService) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    // Simulate email notification with small random delay
    await sleep(50 + Math.random() * 50);

    const emailFailureRate = parseFloat(process.env.EMAIL_FAILURE_RATE ?? '0.05');
    if (Math.random() < emailFailureRate) {
      this.logger.warn(
        `Email notification failed (non-blocking): orderId=${ctx.orderId} customerId=${ctx.customerId}`,
        'NotifyCustomerStep',
      );
      // Non-blocking — order still succeeds
      return Ok({ ...ctx, notified: false });
    }

    this.logger.log(
      `Customer notified: orderId=${ctx.orderId} customerId=${ctx.customerId}`,
      'NotifyCustomerStep',
    );
    return Ok({ ...ctx, notified: true });
  }
}
