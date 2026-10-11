import type { OrderStatusValue, PaymentMethodValue } from './order-state';

export interface LockedOrder {
  id: number;
  status: OrderStatusValue;
  paymentMethod: PaymentMethodValue;
}

export interface OrderLineView {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderView {
  id: number;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  note: string | null;
  createdAt: Date;
  items: OrderLineView[];
}

export interface StockShortage {
  productId: number;
  name: string;
  requested: number;
  available: number;
}
