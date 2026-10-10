import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PaymentStatusValue = NonNullable<Prisma.PaymentCreateInput['status']>;

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Đơn COD: một dòng payments ngay khi tạo đơn. PHẢI gọi bằng `tx`. */
  createCod(
    tx: Prisma.TransactionClient,
    { orderId, amount }: { orderId: number; amount: number },
  ) {
    return tx.payment.create({
      data: { orderId, amount, status: 'PENDING_ON_DELIVERY' },
      select: { id: true },
    });
  }

  /**
   * Đổi trạng thái payments của đơn. `onlyFrom` giới hạn trạng thái nguồn
   * (ví dụ hủy đơn chỉ đổi PENDING / PENDING_ON_DELIVERY sang FAILED).
   * Trả về số dòng đã đổi. Dùng ở ngày 3.
   */
  async setStatus(
    tx: Prisma.TransactionClient,
    orderId: number,
    status: PaymentStatusValue,
    onlyFrom?: PaymentStatusValue[],
  ): Promise<number> {
    const { count } = await tx.payment.updateMany({
      where: { orderId, ...(onlyFrom ? { status: { in: onlyFrom } } : {}) },
      data: { status },
    });
    return count;
  }

  findByOrderId(orderId: number) {
    return this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { id: 'desc' },
      select: { status: true, amount: true },
    });
  }
}
