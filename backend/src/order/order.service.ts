import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import type { Prisma } from '../generated/prisma/client';
import { PaymentService } from '../payment/payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { OrderView, StockShortage, LockedOrder } from './order.types';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly products: ProductService,
    private readonly payments: PaymentService,
  ) {}

  async create(userId: number, dto: CreateOrderDto): Promise<OrderView> {
    if (dto.paymentMethod !== 'COD') {
      throw new BadRequestException(
        'Thanh toán VNPay chưa được hỗ trợ, vui lòng chọn COD',
      );
    }

    // QUY TẮC SỐNG CÒN: trong callback chỉ dùng `tx`, không dùng `this.prisma`.
    // Dùng nhầm this.prisma chạy ngoài transaction mà không báo lỗi.
    const orderId = await this.prisma.$transaction(async (tx) => {
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
          paymentMethod: 'COD',
          shippingName: dto.shippingName,
          shippingPhone: dto.shippingPhone,
          shippingAddress: dto.shippingAddress,
          note: dto.note || null,
          items: { create: lines },
        },
        select: { id: true },
      });
      await this.products.decreaseStock(tx, items);
      await this.payments.createCod(tx, {
        orderId: order.id,
        amount: totalAmount,
      });
      await this.cart.clear(tx, userId);
      return order.id;
    });

    // Transaction đã commit. Tuần 9 publish('order.created') ở ĐÂY (ngoài transaction).
    return this.findOneForUser(userId, orderId);
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
