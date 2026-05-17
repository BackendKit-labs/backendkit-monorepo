import { Customer, OrderItem, InventoryReservation } from '../../../common/entities';

export type OrderError =
  | { kind: 'validation'; message: string }
  | { kind: 'inventory-unavailable'; productId: string; requested: number; available: number }
  | { kind: 'payment-failed'; reason: string }
  | { kind: 'shipment-failed'; reason: string }
  | { kind: 'notification-failed'; reason: string };

export interface OrderContext {
  readonly orderId: string;
  readonly customerId: string;
  readonly items: OrderItem[];
  readonly totalAmount: number;
  readonly paymentMethod: string;
  customer?: Customer;
  inventoryReservations?: InventoryReservation[];
  transactionId?: string;
  shipmentId?: string;
  notified?: boolean;
}
