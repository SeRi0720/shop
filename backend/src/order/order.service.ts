import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import type { Prisma } from '../generated/prisma/client';
import { PaymentService } from '../payment/payment.service';
import { VnpayService } from '../payment/vnpay.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type {
  OrderView,
  StockShortage,
  LockedOrder,
  VnpayApplyOutcome,
  VnpaySyncState,
} from './order.types';
import { canTransition, type AdminTargetStatus } from './order-state';

const MAX_INT = 2_147_483_647;

const orderSelect = {
  id: true,
  status: true,
  totalAmount: true,
  paymentMethod: true,
  shippingName: true,
  shippingPhone: true,
  shippingAddress: true,
  note: true,
  createdAt: true,
  items: {
    select: {
      productId: true,
      productName: true,
      unitPrice: true,
      quantity: true,
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly products: ProductService,
    private readonly payments: PaymentService,
    private readonly vnpay: VnpayService,
  ) {}

  async create(
    userId: number,
    dto: CreateOrderDto,
    ip?: string,
  ): Promise<OrderView> {
    const isVnpay = dto.paymentMethod === 'VNPAY';
    // Kiểm tra TRƯỚC khi tạo gì: thiếu cấu hình thì không có đơn nào bị tạo và trừ kho.
    if (isVnpay && !this.vnpay.isConfigured()) {
      throw new BadRequestException('VNPay chưa được cấu hình');
    }

    const { orderId, vnpayPayment } = await this.prisma.$transaction(
      async (tx) => {
        // 1. Khóa giỏ trước, rồi mới đọc giỏ (chặn đặt trùng của cùng một người)
        await this.cart.lockCart(tx, userId);
        const items = await this.cart.readItems(tx, userId);
        if (items.length === 0) {
          throw new ConflictException('Giỏ hàng trống hoặc đã được đặt');
        }

        // 2. Khóa các dòng sản phẩm theo id tăng dần (chống deadlock)
        const locked = await this.products.lockForUpdate(
          tx,
          items.map((i) => i.productId),
        );
        const byId = new Map(locked.map((p) => [p.id, p]));

        // 3. Kiểm tra tồn kho (kiểm tra có giá trị thật nằm ở đây)
        const shortages: StockShortage[] = [];
        for (const { productId, quantity } of items) {
          const p = byId.get(productId);
          const available = p && p.isActive ? p.stock : 0;
          if (quantity > available) {
            shortages.push({
              productId,
              name: p?.name ?? 'Sản phẩm không còn tồn tại',
              requested: quantity,
              available,
            });
          }
        }
        if (shortages.length > 0) {
          throw new ConflictException({
            message: 'Một số sản phẩm không đủ hàng',
            items: shortages,
          });
        }

        // 4. Tên và giá lấy từ dòng đã khóa, không lấy từ client
        let totalAmount = 0;
        const lines = items.map(({ productId, quantity }) => {
          const p = byId.get(productId)!;
          totalAmount += p.price * quantity;
          return {
            productId,
            productName: p.name,
            unitPrice: p.price,
            quantity,
          };
        });
        if (totalAmount > MAX_INT) {
          throw new BadRequestException('Tổng giá trị đơn hàng vượt giới hạn');
        }

        // 5. Tạo đơn, trừ kho, ghi payments, xóa giỏ
        const order = await tx.order.create({
          data: {
            userId,
            totalAmount,
            paymentMethod: dto.paymentMethod,
            shippingName: dto.shippingName,
            shippingPhone: dto.shippingPhone,
            shippingAddress: dto.shippingAddress,
            note: dto.note || null,
            items: { create: lines },
          },
          select: { id: true },
        });
        await this.products.decreaseStock(tx, items);
        let vnpayPayment: { txnRef: string; createdAt: Date } | null = null;
        if (isVnpay) {
          const txnRef = this.vnpay.makeTxnRef(order.id);
          const payment = await this.payments.createVnpay(tx, {
            orderId: order.id,
            amount: totalAmount,
            txnRef,
          });
          vnpayPayment = { txnRef, createdAt: payment.createdAt };
        } else {
          await this.payments.createCod(tx, {
            orderId: order.id,
            amount: totalAmount,
          });
        }
        await this.cart.clear(tx, userId);
        return { orderId: order.id, vnpayPayment };
      },
    );

    // Transaction đã commit. Tuần 9 publish('order.created') ở ĐÂY (ngoài transaction).
    const view = await this.findOneForUser(userId, orderId);
    if (!vnpayPayment) return view;

    // URL không lưu DB; vnp_CreateDate lấy từ createdAt của dòng payments để
    // sau này queryDr dùng lại đúng giá trị (vnp_TransactionDate).
    const paymentUrl = this.vnpay.buildPaymentUrl({
      txnRef: vnpayPayment.txnRef,
      amount: view.totalAmount,
      orderInfo: `Thanh toan don hang ${orderId}`,
      ip,
      createdAt: vnpayPayment.createdAt,
    });
    return { ...view, paymentUrl };
  }

  /** Chỉ chủ đơn xem được; đơn người khác hoặc không tồn tại đều 404 (không lộ id). */
  async findOneForUser(userId: number, orderId: number): Promise<OrderView> {
    return this.loadView({ id: orderId, userId });
  }

  private async loadView(where: Prisma.OrderWhereInput): Promise<OrderView> {
    const order = await this.prisma.order.findFirst({
      where,
      select: orderSelect,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    const payment = await this.payments.findByOrderId(order.id);
    return {
      ...order,
      paymentStatus: payment?.status ?? null,
      items: order.items.map((i) => ({
        ...i,
        lineTotal: i.unitPrice * i.quantity,
      })),
    };
  }

  /** Chủ đơn hủy đơn. Chỉ hủy được khi PENDING. */
  async cancel(userId: number, orderId: number): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      // Lọc theo userId ngay trong câu khóa: đơn của người khác = không tồn tại (404)
      const order = await this.lockOrder(tx, orderId, userId);
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status !== 'PENDING') {
        throw new ConflictException('Chỉ hủy được đơn đang chờ xử lý');
      }
      await this.cancelLocked(tx, order.id);
    });
    return this.findOneForUser(userId, orderId);
  }

  /** Admin đổi trạng thái theo máy trạng thái. */
  async changeStatus(
    orderId: number,
    to: AdminTargetStatus,
  ): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (!canTransition(order.status, to, order.paymentMethod)) {
        throw new ConflictException(
          `Không thể chuyển đơn từ ${order.status} sang ${to}`,
        );
      }

      if (to === 'CANCELLED') {
        await this.cancelLocked(tx, order.id);
        return;
      }
      await tx.order.update({ where: { id: order.id }, data: { status: to } });
      if (to === 'COMPLETED' && order.paymentMethod === 'COD') {
        // Đã giao và thu tiền: payments của đơn COD thành SUCCESS (quyết định 14)
        await this.payments.setStatus(tx, order.id, 'SUCCESS', [
          'PENDING_ON_DELIVERY',
        ]);
      }
    });
    return this.loadView({ id: orderId });
  }

  // ---- VNPay: IPN và xác nhận bằng queryDr dùng CHUNG applyVnpayResult ----

  /**
   * Áp dụng kết quả VNPay cho một giao dịch. Idempotent.
   * `payload`: các tham số vnp_* đã kiểm chữ ký (không có vnp_SecureHash), từ IPN
   * hoặc từ phản hồi queryDr. Thứ tự kiểm tra: không thấy -> sai số tiền -> đã xác nhận -> xử lý.
   */
  async applyVnpayResult(
    txnRef: string,
    success: boolean,
    payload: Record<string, string>,
  ): Promise<VnpayApplyOutcome> {
    // Đọc không khóa chỉ để biết mã đơn (txnRef không đổi sau khi tạo).
    const peek = await this.payments.findByTxnRef(txnRef);
    if (!peek) return 'NOT_FOUND';

    const outcome = await this.prisma.$transaction(
      async (tx): Promise<VnpayApplyOutcome> => {
        // Khóa dòng đơn TRƯỚC (cùng thứ tự với hủy đơn), rồi mới đọc/ghi payments.
        const order = await this.lockOrder(tx, peek.orderId);
        if (!order) return 'NOT_FOUND';
        // Quyết định dựa trên lần đọc LẠI sau khi đã khóa.
        const payment = await this.payments.findByTxnRef(txnRef, tx);
        if (!payment) return 'NOT_FOUND';

        const reported = payload.vnp_Amount ?? '';
        if (
          !/^\d+$/.test(reported) ||
          Number(reported) !== payment.amount * 100
        ) {
          return 'AMOUNT_MISMATCH';
        }
        if (payment.status === 'SUCCESS') return 'ALREADY_CONFIRMED';

        const info = {
          providerTxnNo: payload.vnp_TransactionNo,
          rawPayload: payload,
        };
        if (success) {
          // Cả khi payments đang FAILED (đơn đã hủy): tiền thật đã thu nên ghi SUCCESS.
          await this.payments.finishVnpay(tx, payment.id, 'SUCCESS', info);
          if (canTransition(order.status, 'PAID', order.paymentMethod)) {
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'PAID' },
            });
            return 'APPLIED_PAID';
          }
          return 'LATE_PAID';
        }

        if (payment.status !== 'PENDING') return 'ALREADY_CONFIRMED';
        await this.payments.finishVnpay(tx, payment.id, 'FAILED', info);
        // cancelLocked hoàn kho; chỉ gọi khi đơn còn PENDING để không hoàn kho hai lần.
        if (order.status === 'PENDING') await this.cancelLocked(tx, order.id);
        return 'APPLIED_FAILED';
      },
    );

    if (outcome === 'LATE_PAID') {
      this.logger.warn(
        `Đã thu tiền VNPay cho đơn #${peek.orderId} nhưng đơn không còn PENDING (txnRef ${txnRef}): cần hoàn tiền thủ công`,
      );
    }
    return outcome;
  }

  /**
   * Hỏi VNPay (queryDr) rồi áp dụng kết quả. Gọi mạng NGOÀI transaction để không
   * giữ khóa dòng đơn trong lúc chờ. Trả trạng thái thanh toán thật sau khi đồng bộ.
   * Không ném lỗi vì VNPay: lỗi mạng/định dạng chỉ cho kết quả 'ERROR' hoặc 'PENDING'.
   */
  async syncVnpayPayment(orderId: number): Promise<VnpaySyncState> {
    const payment = await this.payments.findVnpayByOrderId(orderId);
    if (!payment?.txnRef) return 'ERROR';
    // Đã có kết luận (IPN tới trước, hoặc đơn đã hủy): khỏi hỏi lại VNPay.
    if (payment.status === 'SUCCESS') return 'PAID';
    if (payment.status === 'FAILED') return 'FAILED';

    const result = await this.vnpay.queryTransaction({
      txnRef: payment.txnRef,
      amount: payment.amount,
      transactionDate: payment.createdAt,
    });

    if (result.kind === 'PAID' || result.kind === 'FAILED') {
      const outcome = await this.applyVnpayResult(
        payment.txnRef,
        result.kind === 'PAID',
        result.payload,
      );
      this.logger.log(`queryDr đơn #${orderId}: ${result.kind} -> ${outcome}`);
    } else if (result.kind === 'ERROR') {
      this.logger.warn(`queryDr đơn #${orderId} lỗi: ${result.reason}`);
    }

    // Đọc lại: IPN có thể vừa xử lý xong trong lúc ta chờ VNPay.
    const latest = await this.payments.findByTxnRef(payment.txnRef);
    if (latest?.status === 'SUCCESS') return 'PAID';
    if (latest?.status === 'FAILED') return 'FAILED';
    return result.kind === 'ERROR' ? 'ERROR' : 'PENDING';
  }

  // ---- nội bộ (mọi hàm dưới đây chỉ dùng `tx`) ----

  /**
   * Khóa dòng đơn bằng FOR UPDATE. Hai lần hủy song song xếp hàng ở đây: lần hai
   * chờ, rồi đọc lại bản đã commit (CANCELLED) nên bị từ chối, không hoàn kho thêm.
   * `::text` để nhận enum dưới dạng chuỗi chắc chắn.
   */
  private async lockOrder(
    tx: Prisma.TransactionClient,
    orderId: number,
    userId?: number,
  ): Promise<LockedOrder | null> {
    const rows =
      userId === undefined
        ? await tx.$queryRaw<LockedOrder[]>`
            SELECT id, status::text AS status, payment_method::text AS "paymentMethod"
            FROM orders WHERE id = ${orderId} FOR UPDATE`
        : await tx.$queryRaw<LockedOrder[]>`
            SELECT id, status::text AS status, payment_method::text AS "paymentMethod"
            FROM orders WHERE id = ${orderId} AND user_id = ${userId} FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Hoàn kho, đổi CANCELLED, đổi payments chưa thu tiền sang FAILED. Đơn đã khóa. */
  private async cancelLocked(tx: Prisma.TransactionClient, orderId: number) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
    });
    // UPDATE ... increment tự khóa dòng; ProductService sắp theo id nên không deadlock
    await this.products.increaseStock(tx, items);
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
    // Chỉ payments chưa thu tiền. Đơn VNPAY đã PAID (payments SUCCESS) giữ nguyên:
    // hoàn tiền nằm ngoài phạm vi, ghi vào hạn chế của báo cáo.
    await this.payments.setStatus(tx, orderId, 'FAILED', [
      'PENDING_ON_DELIVERY',
      'PENDING',
    ]);
  }
}
