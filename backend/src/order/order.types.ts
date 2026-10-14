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
  /** Chỉ có khi vừa tạo đơn VNPAY: trình duyệt chuyển hướng tới đây. Không lưu DB. */
  paymentUrl?: string;
}

export interface StockShortage {
  productId: number;
  name: string;
  requested: number;
  available: number;
}

/** Kết quả áp dụng một kết quả VNPay (IPN hoặc queryDr) vào đơn. */
export type VnpayApplyOutcome =
  | 'APPLIED_PAID' // đơn PENDING -> PAID
  | 'APPLIED_FAILED' // đơn PENDING -> CANCELLED, hoàn kho
  | 'LATE_PAID' // đã thu tiền nhưng đơn không còn PENDING (ghi payments SUCCESS)
  | 'ALREADY_CONFIRMED'
  | 'NOT_FOUND'
  | 'AMOUNT_MISMATCH';

/** Trạng thái thanh toán thật sau khi đồng bộ với VNPay. */
export type VnpaySyncState = 'PAID' | 'FAILED' | 'PENDING' | 'ERROR';

/** Tóm tắt một lượt tự hủy đơn VNPay quá hạn (để ghi log và để test). */
export interface ExpirySummary {
  checked: number;
  paid: number; // VNPay báo đã thanh toán nên đơn sang PAID, không hủy
  cancelled: number;
  skipped: number; // truy vấn lỗi hoặc đơn đổi trạng thái giữa chừng: thử lại lượt sau
}
