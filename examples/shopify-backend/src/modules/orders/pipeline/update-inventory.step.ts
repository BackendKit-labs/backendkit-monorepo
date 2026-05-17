import { Injectable } from '@nestjs/common';
import { PipelineStep, Ok, StepResult } from '@backendkit-labs/pipeline';
import { LoggerService } from '@backendkit-labs/observability';
import { OrderContext, OrderError } from './order-pipeline.context';

@Injectable()
export class UpdateInventoryStep implements PipelineStep<OrderContext, OrderError> {
  readonly name = 'update-inventory';

  constructor(private readonly logger: LoggerService) {}

  async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
    // Reservations were already deducted from available stock in CheckInventoryStep.
    // In a real system this would commit them permanently to a database.
    const reservationCount = ctx.inventoryReservations?.length ?? 0;
    this.logger.log(
      `Inventory confirmed: orderId=${ctx.orderId} reservations=${reservationCount}`,
      'UpdateInventoryStep',
    );
    return Ok(ctx);
  }
}
