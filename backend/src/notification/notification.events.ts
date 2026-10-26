import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export const NOTIFICATION = 'notification';
export const KIND_ADMIN_NEW_ORDER = 'ADMIN_NEW_ORDER';

export class NotificationData {
  @IsIn([KIND_ADMIN_NEW_ORDER]) kind!: typeof KIND_ADMIN_NEW_ORDER;
  @IsString() @IsNotEmpty() causationId!: string;
  @IsInt() @Min(1) orderId!: number;
  @IsInt() @Min(0) totalAmount!: number;
  @IsIn(['COD', 'VNPAY']) paymentMethod!: 'COD' | 'VNPAY';
}

/** Có tính xác định (không sinh ngẫu nhiên): nấc 1 chạy lại thì nấc 2 vẫn nhận ra trùng. */
export const deriveAdminNewOrderEventId = (causationId: string): string =>
  `${causationId}:admin-new-order`;
