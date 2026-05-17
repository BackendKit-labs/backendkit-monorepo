import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, Err, StepResult } from '@backendkit-labs/pipeline';
import { LoggerService } from '@backendkit-labs/observability';
import { CustomersService } from '../../customers/customers.service';
import { OrderContext, OrderError } from './order-pipeline.context';

@Injectable()
export class ValidateOrderStep implements PipelineStep<OrderContext, OrderError> {
  readonly name = 'validate-order';

  constructor(
    private readonly customers: CustomersService,
    private readonly logger: LoggerService,
  ) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    if (!ctx.items || ctx.items.length === 0) {
      this.logger.warn(`Order validation failed: no items. orderId=${ctx.orderId}`, 'ValidateOrderStep');
      return Err({ kind: 'validation', message: 'Order must have at least one item' });
    }

    for (const item of ctx.items) {
      if (item.unitPrice <= 0) {
        this.logger.warn(
          `Order validation failed: invalid price for product ${item.productId}. orderId=${ctx.orderId}`,
          'ValidateOrderStep',
        );
        return Err({
          kind: 'validation',
          message: `Item ${item.productId} has invalid unit price`,
        });
      }
      if (item.quantity <= 0) {
        return Err({
          kind: 'validation',
          message: `Item ${item.productId} has invalid quantity`,
        });
      }
    }

    const customer = this.customers.findById(ctx.customerId);
    if (!customer) {
      this.logger.warn(
        `Order validation failed: customer not found ${ctx.customerId}. orderId=${ctx.orderId}`,
        'ValidateOrderStep',
      );
      return Err({ kind: 'validation', message: `Customer ${ctx.customerId} not found` });
    }

    this.logger.log(`Order validated: orderId=${ctx.orderId} customerId=${ctx.customerId}`, 'ValidateOrderStep');
    return Ok({ ...ctx, customer });
  }
}
