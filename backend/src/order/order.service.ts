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
import { VnpayService, formatVnDate } from '../payment/vnpay.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type {
  OrderView,
  StockShortage,
  LockedOrder,
  VnpayApplyOutcome,
  VnpaySyncState,
  ExpirySummary,
  Paginated,
  OrderListItem,
  AdminOrderListItem,
  AdminOrderView,
} from './order.types';
import {
  canTransition,
  type AdminTargetStatus,
  nextAdminStatuses,
  type OrderStatusValue,
  type PaymentMethodValue,
} from './order-state';
import { escapeLike } from '../common/escape-like';
import { vnDayEnd, vnDayStart } from '../common/vn-date';
import { AdminOrderQueryDto, OrderListQueryDto } from './dto/order-query.dto';

const MAX_INT = 2_147_483_647;

// Đơn VNPay chỉ bị tự hủy sau khi URL hết hạn + phần đệm cho IPN/truy vấn đến muộn.
const EXPIRY_GRACE_MINUTES = 2;
const EXPIRY_BATCH_SIZE = 20;
const QUERY_BACKOFF_MS = 5 * 60_000;

const vnClock = (d: Date) => {
  const s = formatVnDate(d);
  return `${s.slice(8, 10)}:${s.slice(10, 12)}`;
};

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

const listSelect = {
  id: true,
  status: true,
  totalAmount: true,
  paymentMethod: true,
  shippingName: true,
  shippingPhone: true,
  createdAt: true,
  _count: { select: { items: true } },
  items: { select: { productName: true }, orderBy: { id: 'asc' }, take: 1 },
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  // orderId -> thời điểm (ms) được phép hỏi VNPay lại. Chỉ giữ trong bộ nhớ của instance này.
  private readonly queryBackoffUntil = new Map<number, number>();

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

    // QUY TẮC SỐNG CÒN: trong callback chỉ dùng `tx`, không dùng `this.prisma`.
    // Dùng nhầm this.prisma chạy ngoài transaction mà không báo lỗi.
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

  async listForUser(
    userId: number,
    query: OrderListQueryDto,
  ): Promise<Paginated<OrderListItem>> {
    const page = await this.queryPage({ userId }, query);
    return {
      ...page,
      items: page.items.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        itemCount: o.itemCount,
        firstItemName: o.firstItemName,
      })),
    };
  }

  async listForAdmin(
    query: AdminOrderQueryDto,
  ): Promise<Paginated<AdminOrderListItem>> {
    const page = await this.queryPage(this.buildAdminWhere(query), query);
    return {
      ...page,
      items: page.items.map((o) => ({
        ...o,
        nextStatuses: this.nextStatuses(
          o.status as OrderStatusValue,
          o.paymentMethod as PaymentMethodValue,
          o.createdAt,
        ),
      })),
    };
  }

  async findOneForAdmin(orderId: number): Promise<AdminOrderView> {
    const view = await this.loadView({ id: orderId });
    return {
      ...view,
      nextStatuses: this.nextStatuses(
        view.status as OrderStatusValue,
        view.paymentMethod as PaymentMethodValue,
        view.createdAt,
      ),
    };
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
      paymentExpiresAt:
        order.paymentMethod === 'VNPAY' && order.status === 'PENDING'
          ? new Date(
              order.createdAt.getTime() + this.vnpay.urlTtlMinutes * 60_000,
            )
          : null,
      items: order.items.map((i) => ({
        ...i,
        lineTotal: i.unitPrice * i.quantity,
      })),
    };
  }

  /**
   * Chủ đơn hủy đơn. Chỉ hủy được khi PENDING. Đơn VNPAY PENDING chỉ hủy được khi URL
   * đã hết hạn, và phải hỏi VNPay trước (quyết định 15).
   */
  async cancel(userId: number, orderId: number): Promise<OrderView> {
    // Đọc không khóa chỉ để biết có phải đơn VNPay đang chờ không: bước đó cần gọi mạng
    // nên không được làm trong transaction. Quyết định cuối vẫn nằm dưới khóa bên dưới.
    const peek = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { status: true, paymentMethod: true, createdAt: true },
    });
    if (!peek) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (peek.paymentMethod === 'VNPAY' && peek.status === 'PENDING') {
      const verdict = await this.checkVnpayBeforeCancel(
        orderId,
        peek.createdAt,
      );
      if (verdict === 'DONE') return this.findOneForUser(userId, orderId);
    }

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
    if (to === 'CANCELLED') {
      // Cùng điều kiện với chủ đơn hủy (quyết định 15). Không thấy đơn thì để transaction báo 404.
      const peek = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true, paymentMethod: true, createdAt: true },
      });
      if (peek?.paymentMethod === 'VNPAY' && peek.status === 'PENDING') {
        const verdict = await this.checkVnpayBeforeCancel(
          orderId,
          peek.createdAt,
        );
        if (verdict === 'DONE') return this.loadView({ id: orderId });
      }
    }

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

    const backoffUntil = this.queryBackoffUntil.get(orderId);
    if (backoffUntil !== undefined) {
      if (Date.now() < backoffUntil) return 'ERROR'; // VNPay vừa từ chối vì trùng yêu cầu
      this.queryBackoffUntil.delete(orderId);
    }

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
      if (result.rateLimited) {
        this.queryBackoffUntil.set(orderId, Date.now() + QUERY_BACKOFF_MS);
      }
      this.logger.warn(`queryDr đơn #${orderId} lỗi: ${result.reason}`);
    }

    // Đọc lại: IPN có thể vừa xử lý xong trong lúc ta chờ VNPay.
    const latest = await this.payments.findByTxnRef(payment.txnRef);
    if (latest?.status === 'SUCCESS') return 'PAID';
    if (latest?.status === 'FAILED') return 'FAILED';
    return result.kind === 'ERROR' ? 'ERROR' : 'PENDING';
  }

  /**
   * Kiểm tra thanh toán thủ công (quyết định 24): chủ đơn hoặc admin. Chỉ đơn VNPAY đang
   * PENDING. Đơn của người khác trả 404 (không lộ id).
   */
  async checkPayment(
    actor: { id: number; role: 'USER' | 'ADMIN' },
    orderId: number,
  ): Promise<OrderView> {
    const where: Prisma.OrderWhereInput =
      actor.role === 'ADMIN'
        ? { id: orderId }
        : { id: orderId, userId: actor.id };
    const order = await this.prisma.order.findFirst({
      where,
      select: { status: true, paymentMethod: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.paymentMethod !== 'VNPAY' || order.status !== 'PENDING') {
      throw new ConflictException(
        'Chỉ kiểm tra được đơn VNPay đang chờ thanh toán',
      );
    }
    await this.syncVnpayPayment(orderId);
    return this.loadView(where);
  }

  /**
   * Tự hủy đơn VNPay quá hạn (quyết định 14). Từng đơn: hỏi VNPay trước (ngoài transaction);
   * đã thanh toán thì áp dụng và KHÔNG hủy; chỉ hủy khi VNPay xác nhận chưa có thanh toán
   * hoặc báo thất bại. Truy vấn lỗi thì bỏ qua, thử lại ở lượt sau. Nhận `now` để test được.
   */
  async cancelExpiredVnpayOrders(
    now: Date = new Date(),
  ): Promise<ExpirySummary> {
    const summary: ExpirySummary = {
      checked: 0,
      paid: 0,
      cancelled: 0,
      skipped: 0,
    };
    // Chưa cấu hình thì không thể hỏi VNPay, mà không hỏi thì không được hủy.
    if (!this.vnpay.isConfigured()) return summary;

    const cutoff = new Date(
      now.getTime() -
        (this.vnpay.urlTtlMinutes + EXPIRY_GRACE_MINUTES) * 60_000,
    );
    const candidates = await this.prisma.order.findMany({
      where: {
        paymentMethod: 'VNPAY',
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      orderBy: { id: 'asc' },
      take: EXPIRY_BATCH_SIZE,
      select: { id: true },
    });

    for (const { id } of candidates) {
      summary.checked++;
      try {
        const state = await this.syncVnpayPayment(id); // ngoài transaction
        if (state === 'PAID') summary.paid++;
        else if (state === 'FAILED')
          summary.cancelled++; // sync đã hủy đơn
        else if (state === 'PENDING') {
          // VNPay trả lời bình thường và chưa có thanh toán
          if (await this.cancelUnpaidVnpay(id)) summary.cancelled++;
          else summary.skipped++;
        } else summary.skipped++; // ERROR: không biết đã trả tiền chưa, không hủy
      } catch (error) {
        summary.skipped++;
        this.logger.error(`Tự hủy đơn #${id} lỗi: ${String(error)}`);
      }
    }
    return summary;
  }

  /**
   * Quyết định 15, chạy NGOÀI transaction. Ném 409 nếu chưa được hủy;
   * trả 'DONE' nếu trong lúc kiểm tra đơn đã được hủy (không cần hủy nữa);
   * trả 'PROCEED' nếu được phép đi tiếp vào bước hủy dưới khóa.
   */
  private async checkVnpayBeforeCancel(
    orderId: number,
    createdAt: Date,
    now: Date = new Date(),
  ): Promise<'PROCEED' | 'DONE'> {
    const unverifiable = new ConflictException(
      'Chưa kiểm tra được thanh toán VNPay, vui lòng thử lại sau',
    );
    if (!this.vnpay.isConfigured()) throw unverifiable;

    const expiresAt = new Date(
      createdAt.getTime() + this.vnpay.urlTtlMinutes * 60_000,
    );
    if (now.getTime() < expiresAt.getTime()) {
      throw new ConflictException(
        `Đơn đang chờ thanh toán VNPay, sẽ tự hủy sau ${vnClock(expiresAt)} nếu chưa thanh toán`,
      );
    }
    // Hết hạn: người dùng có thể đã trả tiền mà chưa ai xác nhận, nên hỏi VNPay trước khi hủy.
    const state = await this.syncVnpayPayment(orderId);
    if (state === 'PAID') {
      throw new ConflictException('Đơn đã thanh toán, không thể hủy');
    }
    if (state === 'FAILED') return 'DONE';
    if (state === 'ERROR') throw unverifiable;
    return 'PROCEED';
  }

  /** Hủy một đơn VNPay chưa thanh toán. Khóa dòng đơn rồi kiểm tra LẠI trước khi hủy. */
  private async cancelUnpaidVnpay(orderId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      // Có thể IPN vừa tới (PAID) hoặc lượt khác vừa hủy (CANCELLED): để yên.
      if (!order || order.status !== 'PENDING') return false;
      if (order.paymentMethod !== 'VNPAY') return false;
      await this.cancelLocked(tx, order.id);
      return true;
    });
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

  // ---- đọc danh sách (không dùng tx) ----

  /** Đếm + lấy trang dùng chung một where; trạng thái thanh toán lấy bằng MỘT truy vấn cho cả trang. */
  private async queryPage(
    where: Prisma.OrderWhereInput,
    query: OrderListQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        // id làm khóa phụ để thứ tự ổn định giữa các trang
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: listSelect,
      }),
    ]);
    const pay = await this.payments.findLatestByOrderIds(rows.map((r) => r.id));
    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        status: r.status,
        paymentMethod: r.paymentMethod,
        paymentStatus: pay.get(r.id)?.status ?? null,
        totalAmount: r.totalAmount,
        itemCount: r._count.items,
        firstItemName: r.items[0]?.productName ?? null,
        shippingName: r.shippingName,
        shippingPhone: r.shippingPhone,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildAdminWhere(query: AdminOrderQueryDto): Prisma.OrderWhereInput {
    const from = query.from ? vnDayStart(query.from) : undefined;
    const to = query.to ? vnDayEnd(query.to) : undefined;
    if (from === null || to === null) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    if (from && to && from > to) {
      throw new BadRequestException('from không được sau to');
    }

    const q = query.q?.trim();
    let or: Prisma.OrderWhereInput[] | undefined;
    if (q) {
      or = [{ shippingPhone: { contains: escapeLike(q) } }];
      if (/^\d+$/.test(q)) {
        // Số quá lớn sẽ làm Prisma ném lỗi tràn Int, nên chỉ thử khớp mã đơn khi vừa kiểu Int
        if (Number(q) <= MAX_INT) or.push({ id: Number(q) });
      } else {
        or.push({
          shippingName: { contains: escapeLike(q), mode: 'insensitive' },
        });
      }
    }

    return {
      status: query.status,
      paymentMethod: query.paymentMethod,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
      OR: or,
    };
  }

  /**
   * Trạng thái admin được chọn tiếp theo. Đơn VNPay PENDING còn trong thời hạn thanh toán
   * thì ẩn CANCELLED (khớp quyết định 15, tránh nút bấm vào là 409).
   */
  private nextStatuses(
    status: OrderStatusValue,
    method: PaymentMethodValue,
    createdAt: Date,
    now: Date = new Date(),
  ) {
    const all = nextAdminStatuses(status, method);
    if (method === 'VNPAY' && status === 'PENDING') {
      const expiresAt = createdAt.getTime() + this.vnpay.urlTtlMinutes * 60_000;
      if (now.getTime() < expiresAt)
        return all.filter((s) => s !== 'CANCELLED');
    }
    return all;
  }
}
