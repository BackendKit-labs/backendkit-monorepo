import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, StepResult } from '@backendkit-labs/pipeline';
import { LoggerService } from '@backendkit-labs/observability';
import { InventoryService } from '../../inventory/inventory.service';
import { OrderContext, OrderError } from './order-pipeline.context';

@Injectable()
export class UpdateInventoryStep implements PipelineStep<OrderContext, OrderError> {
  readonly name = 'update-inventory';

  constructor(
    private readonly inventory: InventoryService,
    private readonly logger: LoggerService,
  ) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    const reservations = ctx.inventoryReservations ?? [];
    for (const reservation of reservations) {
      await this.inventory.confirm(reservation.reservationId);
    }
    this.logger.log(
      `Inventory confirmed: orderId=${ctx.orderId} reservations=${reservations.length}`,
      'UpdateInventoryStep',
    );
    return Ok(ctx);
  }
}
