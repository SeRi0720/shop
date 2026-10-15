export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
export type PaymentMethodValue = 'COD' | 'VNPAY';

/** Đích mà admin được yêu cầu. `PAID` chỉ do IPN VNPay đặt (tuần 5). */
export const ADMIN_TARGET_STATUSES = [
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
] as const;
export type AdminTargetStatus = (typeof ADMIN_TARGET_STATUSES)[number];

const BOTH: readonly PaymentMethodValue[] = ['COD', 'VNPAY'];

// from -> to -> phương thức thanh toán được phép. COMPLETED, CANCELLED là trạng thái cuối.
const TRANSITIONS: Record<
  OrderStatusValue,
  Partial<Record<OrderStatusValue, readonly PaymentMethodValue[]>>
> = {
  PENDING: { SHIPPING: ['COD'], PAID: ['VNPAY'], CANCELLED: BOTH },
  PAID: { SHIPPING: ['VNPAY'], CANCELLED: ['VNPAY'] },
  SHIPPING: { COMPLETED: BOTH },
  COMPLETED: {},
  CANCELLED: {},
};

export function canTransition(
  from: OrderStatusValue,
  to: OrderStatusValue,
  method: PaymentMethodValue,
): boolean {
  return TRANSITIONS[from][to]?.includes(method) ?? false;
}

/** Các trạng thái admin được phép chọn tiếp theo, suy ra từ canTransition (nguồn sự thật duy nhất). */
export function nextAdminStatuses(
  from: OrderStatusValue,
  method: PaymentMethodValue,
): AdminTargetStatus[] {
  return ADMIN_TARGET_STATUSES.filter((to) => canTransition(from, to, method));
}
