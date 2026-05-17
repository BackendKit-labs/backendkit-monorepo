import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, Err, StepResult } from '@backendkit-labs/pipeline';
import { LoggerService } from '@backendkit-labs/observability';
import { InventoryService } from '../../inventory/inventory.service';
import { InventoryReservation } from '../../../common/entities';
import { OrderContext, OrderError } from './order-pipeline.context';

@Injectable()
export class CheckInventoryStep implements PipelineStep<OrderContext, OrderError> {
  readonly name = 'check-inventory';

  constructor(
    private readonly inventory: InventoryService,
    private readonly logger: LoggerService,
  ) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    const reservations: InventoryReservation[] = [];

    for (const item of ctx.items) {
      const result = await this.inventory.reserve(item.productId, item.quantity);
      if (!result.ok) {
        // Compensating transaction — release already-made reservations
        this.logger.warn(
          `Inventory unavailable: product=${item.productId} requested=${item.quantity} available=${result.error.available}. Releasing ${reservations.length} prior reservations.`,
          'CheckInventoryStep',
        );
        for (const reservation of reservations) {
          await this.inventory.release(reservation.reservationId);
        }
        return Err({
          kind: 'inventory-unavailable',
          productId: item.productId,
          requested: item.quantity,
          available: result.error.available,
        });
      }
      reservations.push(result.value);
    }

    this.logger.log(
      `Inventory reserved: orderId=${ctx.orderId} reservations=${reservations.length}`,
      'CheckInventoryStep',
    );
    return Ok({ ...ctx, inventoryReservations: reservations });
  }
}
