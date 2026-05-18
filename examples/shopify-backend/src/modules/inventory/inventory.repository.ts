import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { InMemoryStore } from '../../infrastructure/store/in-memory.store';
import { InventoryItem, InventoryReservation } from '../../common/entities';

@Injectable()
export class InventoryRepository {
  private readonly stockStore = new InMemoryStore<InventoryItem>();
  private readonly reservations = new Map<string, InventoryReservation>();

  initialize(productId: string, stock: number): void {
    const item: InventoryItem = {
      id: productId,
      productId,
      stock,
      reserved: 0,
    };
    this.stockStore.save(item);
  }

  getStock(productId: string): number {
    const item = this.stockStore.findById(productId);
    return item ? item.stock - item.reserved : 0;
  }

  getItem(productId: string): InventoryItem | undefined {
    return this.stockStore.findById(productId);
  }

  reserve(productId: string, quantity: number): InventoryReservation | null {
    const item = this.stockStore.findById(productId);
    if (!item) return null;

    const available = item.stock - item.reserved;
    if (available < quantity) return null;

    this.stockStore.update(productId, { reserved: item.reserved + quantity });

    const reservation: InventoryReservation = {
      reservationId: uuid(),
      productId,
      quantity,
    };
    this.reservations.set(reservation.reservationId, reservation);
    return reservation;
  }

  confirm(reservationId: string): boolean {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) return false;

    const item = this.stockStore.findById(reservation.productId);
    if (item) {
      this.stockStore.update(reservation.productId, {
        stock: Math.max(0, item.stock - reservation.quantity),
        reserved: Math.max(0, item.reserved - reservation.quantity),
      });
    }

    this.reservations.delete(reservationId);
    return true;
  }

  release(reservationId: string): boolean {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) return false;

    const item = this.stockStore.findById(reservation.productId);
    if (item) {
      const newReserved = Math.max(0, item.reserved - reservation.quantity);
      this.stockStore.update(reservation.productId, { reserved: newReserved });
    }

    this.reservations.delete(reservationId);
    return true;
  }

  getReservation(reservationId: string): InventoryReservation | undefined {
    return this.reservations.get(reservationId);
  }
}
