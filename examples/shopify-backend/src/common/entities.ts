export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // cents
  variants: ProductVariant[];
  createdAt: Date;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number; // cents
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface InventoryItem {
  id: string;       // productId
  productId: string;
  stock: number;
  reserved: number;
}

export interface InventoryReservation {
  reservationId: string;
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'cancelled';
  transactionId?: string;
  shipmentId?: string;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  transactionId: string;
  status: 'charged' | 'refunded';
  createdAt: Date;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  customerId: string;
  status: 'created' | 'in_transit' | 'delivered';
  trackingNumber: string;
  createdAt: Date;
}
