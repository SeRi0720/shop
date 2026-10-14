import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PaymentStatusValue = NonNullable<Prisma.PaymentCreateInput['status']>;
// Cả PrismaService lẫn `tx` của transaction đều có `payment`.
type PaymentClient = Pick<Prisma.TransactionClient, 'payment'>;

const vnpayRowSelect = {
  id: true,
  orderId: true,
  txnRef: true,
  amount: true,
  status: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

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
   * Đơn VNPAY: một dòng payments PENDING ngay khi tạo đơn (quyết định 5).
   * Trả về `createdAt` để dựng URL (vnp_CreateDate) và để truy vấn lại sau này.
   * PHẢI gọi bằng `tx`.
   */
  createVnpay(
    tx: Prisma.TransactionClient,
    {
      orderId,
      amount,
      txnRef,
    }: { orderId: number; amount: number; txnRef: string },
  ) {
    return tx.payment.create({
      data: { orderId, amount, txnRef, status: 'PENDING' },
      select: { id: true, createdAt: true },
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

  /** Ghi kết quả cuối của một giao dịch VNPay. PHẢI gọi khi đang giữ khóa dòng đơn. */
  finishVnpay(
    tx: Prisma.TransactionClient,
    paymentId: number,
    status: 'SUCCESS' | 'FAILED',
    info: { providerTxnNo?: string; rawPayload: Record<string, string> },
  ) {
    return tx.payment.update({
      where: { id: paymentId },
      data: {
        status,
        providerTxnNo: info.providerTxnNo ?? null,
        rawPayload: info.rawPayload,
      },
      select: { id: true },
    });
  }

  findByOrderId(orderId: number) {
    return this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { id: 'desc' },
      select: { status: true, amount: true },
    });
  }

  /** `client` mặc định là this.prisma (đọc không khóa); truyền `tx` để đọc lại trong transaction. */
  findByTxnRef(txnRef: string, client: PaymentClient = this.prisma) {
    return client.payment.findUnique({
      where: { txnRef },
      select: vnpayRowSelect,
    });
  }

  /** Dòng payments VNPay mới nhất của đơn (đơn COD không có txnRef nên trả null). */
  findVnpayByOrderId(orderId: number) {
    return this.prisma.payment.findFirst({
      where: { orderId, txnRef: { not: null } },
      orderBy: { id: 'desc' },
      select: vnpayRowSelect,
    });
  }

  /** Trạng thái thanh toán mới nhất của nhiều đơn bằng MỘT truy vấn (tránh N+1 ở danh sách). */
  async findLatestByOrderIds(ids: number[]) {
    if (ids.length === 0) {
      return new Map<number, { status: PaymentStatusValue; amount: number }>();
    }
    const rows = await this.prisma.payment.findMany({
      where: { orderId: { in: ids } },
      orderBy: { id: 'desc' },
      distinct: ['orderId'],
      select: { orderId: true, status: true, amount: true },
    });
    return new Map(rows.map((r) => [r.orderId, r]));
  }
}
