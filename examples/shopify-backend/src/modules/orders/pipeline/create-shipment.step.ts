import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, Err, StepResult } from '@backendkit-labs/pipeline';
import { LoggerService } from '@backendkit-labs/observability';
import { ShippingService } from '../../shipping/shipping.service';
import { OrderContext, OrderError } from './order-pipeline.context';

@Injectable()
export class CreateShipmentStep implements PipelineStep<OrderContext, OrderError> {
  readonly name = 'create-shipment';

  constructor(
    private readonly shipping: ShippingService,
    private readonly logger: LoggerService,
  ) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    const result = await this.shipping.createShipment({
      orderId: ctx.orderId,
      customerId: ctx.customerId,
      items: ctx.items,
    });

    if (!result.ok) {
      this.logger.error(
        `Shipment creation failed: orderId=${ctx.orderId} reason=${result.error.message}`,
        'CreateShipmentStep',
      );
      return Err({ kind: 'shipment-failed', reason: result.error.message });
    }

    const { shipmentId } = result.value;
    this.logger.log(
      `Shipment created: orderId=${ctx.orderId} shipmentId=${shipmentId}`,
      'CreateShipmentStep',
    );
    return Ok({ ...ctx, shipmentId });
  }
}
