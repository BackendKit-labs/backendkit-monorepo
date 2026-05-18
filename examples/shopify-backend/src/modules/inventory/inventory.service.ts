import { Injectable } from '@nestjs/common';
import { ok, fail, Result } from '@backendkit-labs/result';
import { MetricsService, LoggerService, TrackPerformance } from '@backendkit-labs/observability';
import { InventoryRepository } from './inventory.repository';
import { InventoryReservation } from '../../common/entities';

@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
  ) {}

  @TrackPerformance()
  async reserve(
    productId: string,
    qty: number,
  ): Promise<Result<InventoryReservation, { available: number }>> {
    const available = this.repository.getStock(productId);
    if (available < qty) {
      this.logger.warn(
        `Inventory reserve failed: product=${productId} requested=${qty} available=${available}`,
        'InventoryService',
      );
      return fail({ available });
    }

    const reservation = this.repository.reserve(productId, qty);
    if (!reservation) {
      return fail({ available: 0 });
    }

    this.metrics.record('inventory.reserved', qty);
    this.logger.log(
      `Reserved ${qty} units of product ${productId}, reservationId=${reservation.reservationId}`,
      'InventoryService',
    );
    return ok(reservation);
  }

  async confirm(reservationId: string): Promise<Result<void, string>> {
    const confirmed = this.repository.confirm(reservationId);
    if (!confirmed) {
      this.logger.warn(`Reservation not found for confirm: ${reservationId}`, 'InventoryService');
      return fail(`Reservation ${reservationId} not found`);
    }
    this.logger.log(`Confirmed reservation ${reservationId}`, 'InventoryService');
    return ok(undefined);
  }

  async release(reservationId: string): Promise<Result<void, string>> {
    const released = this.repository.release(reservationId);
    if (!released) {
      this.logger.warn(`Reservation not found: ${reservationId}`, 'InventoryService');
      return fail(`Reservation ${reservationId} not found`);
    }
    this.logger.log(`Released reservation ${reservationId}`, 'InventoryService');
    return ok(undefined);
  }

  getStock(productId: string): number {
    return this.repository.getStock(productId);
  }

  initialize(productId: string, stock: number): void {
    this.repository.initialize(productId, stock);
    this.logger.log(`Initialized inventory for product ${productId}: ${stock} units`, 'InventoryService');
  }
}
