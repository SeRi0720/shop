import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import type { CartProductInfo } from '../product/product.types';
import { MAX_CART_LINES, MAX_QTY_PER_LINE } from './cart.constants';
import type { CartLine, CartProblem, CartView } from './cart.types';
import type { Prisma } from '../generated/prisma/client';

const hasPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

export function problemOf(
  p: Pick<CartProductInfo, 'isActive' | 'stock'>,
  quantity: number,
): CartProblem | null {
  if (!p.isActive) return 'HIDDEN';
  if (p.stock <= 0) return 'OUT_OF_STOCK';
  if (quantity > p.stock) return 'EXCEEDS_STOCK';
  return null;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductService,
  ) {}

  async getCart(userId: number): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: {
        items: {
          select: { productId: true, quantity: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    return this.toView(cart?.items ?? []);
  }

  async addItem(userId: number, productId: number, quantity: number) {
    const product = await this.requireActiveProduct(productId);
    const cartId = await this.getOrCreateCartId(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
      select: { quantity: true },
    });
    this.assertQuantity((existing?.quantity ?? 0) + quantity, product);

    if (!existing) {
      const lines = await this.prisma.cartItem.count({ where: { cartId } });
      if (lines >= MAX_CART_LINES) {
        throw new BadRequestException(
          `Giỏ hàng tối đa ${MAX_CART_LINES} sản phẩm khác nhau`,
        );
      }
    }

    const total = (existing?.quantity ?? 0) + quantity;
    try {
      await this.prisma.cartItem.upsert({
        where: { cartId_productId: { cartId, productId } },
        update: { quantity: total },
        create: { cartId, productId, quantity: total },
      });
    } catch (error) {
      if (hasPrismaCode(error, 'P2003')) {
        throw new NotFoundException('Không tìm thấy sản phẩm');
      }
      if (hasPrismaCode(error, 'P2002')) {
        throw new ConflictException('Thao tác trùng lặp, vui lòng thử lại');
      }
      throw error;
    }
    return this.getCart(userId);
  }

  async setQuantity(userId: number, productId: number, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { productId, cart: { userId } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Sản phẩm không có trong giỏ hàng');

    const product = await this.requireActiveProduct(productId);
    this.assertQuantity(quantity, product);

    try {
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    } catch (error) {
      if (hasPrismaCode(error, 'P2025')) {
        throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
      }
      throw error;
    }
    return this.getCart(userId);
  }

  async removeItem(userId: number, productId: number) {
    // deleteMany: xóa dòng không có trong giỏ vẫn thành công (idempotent)
    await this.prisma.cartItem.deleteMany({
      where: { productId, cart: { userId } },
    });
    return this.getCart(userId);
  }

  /**
   * Khóa dòng giỏ của người dùng (FOR UPDATE). Hai lần đặt đồng thời của cùng
   * một người sẽ xếp hàng ở đây. Trả null nếu người dùng chưa có giỏ.
   */
  async lockCart(tx: Prisma.TransactionClient, userId: number) {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM carts WHERE user_id = ${userId} FOR UPDATE`;
    return rows[0]?.id ?? null;
  }

  /** Đọc dòng giỏ. PHẢI gọi SAU lockCart (Read Committed: câu lệnh sau thấy dữ liệu đã commit mới nhất). */
  async readItems(tx: Prisma.TransactionClient, userId: number) {
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: {
        items: {
          select: { productId: true, quantity: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    return cart?.items ?? [];
  }

  async clear(tx: Prisma.TransactionClient, userId: number) {
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
  }

  // ---- nội bộ ----

  private async requireActiveProduct(productId: number) {
    const [product] = await this.products.findManyForCart([productId]);
    if (!product || !product.isActive) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    return product;
  }

  /** Kiểm tra để báo sớm; kiểm tra có giá trị thật nằm ở checkout (sau khi khóa dòng). */
  private assertQuantity(total: number, product: CartProductInfo) {
    if (total > MAX_QTY_PER_LINE) {
      throw new BadRequestException(
        `Mỗi sản phẩm tối đa ${MAX_QTY_PER_LINE} cái trong giỏ`,
      );
    }
    if (product.stock <= 0) throw new ConflictException('Sản phẩm đã hết hàng');
    if (total > product.stock) {
      throw new ConflictException(
        `Chỉ còn ${product.stock} sản phẩm trong kho`,
      );
    }
  }

  /** Giỏ tạo lười ở lần thêm đầu tiên. Hai request đầu song song có thể cùng chạm P2002. */
  private async getOrCreateCartId(userId: number): Promise<number> {
    try {
      const cart = await this.prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true },
      });
      return cart.id;
    } catch (error) {
      if (!hasPrismaCode(error, 'P2002')) throw error;
      const cart = await this.prisma.cart.findUniqueOrThrow({
        where: { userId },
        select: { id: true },
      });
      return cart.id;
    }
  }

  private async toView(
    items: { productId: number; quantity: number }[],
  ): Promise<CartView> {
    const infos = await this.products.findManyForCart(
      items.map((i) => i.productId),
    );
    const byId = new Map(infos.map((p) => [p.id, p]));

    const lines: CartLine[] = items.map(({ productId, quantity }) => {
      const p = byId.get(productId);
      if (!p) {
        return {
          productId,
          name: 'Sản phẩm không còn tồn tại',
          price: 0,
          quantity,
          stock: 0,
          thumbnailUrl: null,
          lineTotal: 0,
          problem: 'HIDDEN',
        };
      }
      return {
        productId,
        name: p.name,
        price: p.price,
        quantity,
        stock: p.stock,
        thumbnailUrl: p.thumbnailUrl,
        lineTotal: p.price * quantity,
        problem: problemOf(p, quantity),
      };
    });

    return {
      items: lines,
      totalQuantity: lines.reduce((s, l) => s + l.quantity, 0),
      totalAmount: lines.reduce((s, l) => s + l.lineTotal, 0),
      hasProblem: lines.some((l) => l.problem !== null),
    };
  }
}
