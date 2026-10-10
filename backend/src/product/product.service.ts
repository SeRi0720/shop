import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ProductListItemDto,
  ProductListResponseDto,
} from './dto/product-list-response.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  productCartSelect,
  productInclude,
  productListSelect,
} from './product.include';
import type {
  CartProductInfo,
  LockedProduct,
  StockLine,
} from './product.types';

const MAX_INT = 2_147_483_647;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: ProductQueryDto,
    includeHidden: boolean,
  ): Promise<ProductListResponseDto> {
    const { minPrice, maxPrice } = query;
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice không được lớn hơn maxPrice');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const q = query.q?.trim();

    // Giá trị undefined trong where bị Prisma bỏ qua, nên không cần if lồng nhau.
    const where: Prisma.ProductWhereInput = {
      isActive: includeHidden ? undefined : true,
      name: q ? { contains: escapeLike(q), mode: 'insensitive' } : undefined,
      categoryId: query.categoryId,
      brandId: query.brandId,
      price: { gte: minPrice, lte: maxPrice },
    };

    // Thêm id làm khóa phụ để thứ tự ổn định, tránh trùng/sót sản phẩm giữa các trang.
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ price: 'asc' }, { id: 'desc' }]
        : query.sort === 'price_desc'
          ? [{ price: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];

    // Đếm và lấy dữ liệu dùng chung một `where`, trong một transaction.
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: productListSelect,
      }),
    ]);

    return {
      items: rows.map((row) => ProductListItemDto.from(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number, includeHidden: boolean) {
    const product =
      id > MAX_INT
        ? null
        : await this.prisma.product.findFirst({
            where: { id, isActive: includeHidden ? undefined : true },
            include: productInclude,
          });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return ProductResponseDto.from(product);
  }

  async create(dto: CreateProductDto) {
    await this.assertRefs(dto.categoryId, dto.brandId);
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        specs: dto.specs ?? {},
      },
      include: productInclude,
    });
    return ProductResponseDto.from(product);
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id, true); // 404 nếu không tồn tại
    await this.assertRefs(dto.categoryId, dto.brandId);
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: productInclude,
    });
    return ProductResponseDto.from(product);
  }

  async findManyForCart(ids: number[]): Promise<CartProductInfo[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: productCartSelect,
    });
    return rows.map(({ images, ...p }) => ({
      ...p,
      thumbnailUrl: images[0]?.url ?? null,
    }));
  }

  // Phải gọi bằng `tx` của transaction đang chạy; ORDER BY id để tránh deadlock.
  lockForUpdate(
    tx: Prisma.TransactionClient,
    ids: number[],
  ): Promise<LockedProduct[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return tx.$queryRaw<LockedProduct[]>`
      SELECT id, name, price, stock, is_active AS "isActive"
      FROM products
      WHERE id = ANY(${ids}::int[])
      ORDER BY id
      FOR UPDATE`;
  }

  async decreaseStock(tx: Prisma.TransactionClient, lines: StockLine[]) {
    for (const { productId, quantity } of this.sortedLines(lines)) {
      // stock >= quantity nằm trong WHERE nên kho không bao giờ âm.
      const { count } = await tx.product.updateMany({
        where: { id: productId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (count !== 1) throw new ConflictException('Không đủ tồn kho');
    }
  }

  async increaseStock(tx: Prisma.TransactionClient, lines: StockLine[]) {
    for (const { productId, quantity } of this.sortedLines(lines)) {
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
      });
    }
  }

  private sortedLines(lines: StockLine[]): StockLine[] {
    for (const l of lines) {
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        throw new Error(`Số lượng không hợp lệ cho sản phẩm ${l.productId}`);
      }
    }
    return [...lines].sort((a, b) => a.productId - b.productId);
  }

  private async assertRefs(categoryId?: number, brandId?: number) {
    const [category, brand] = await Promise.all([
      categoryId === undefined
        ? 1
        : this.prisma.category.count({ where: { id: categoryId } }),
      brandId === undefined
        ? 1
        : this.prisma.brand.count({ where: { id: brandId } }),
    ]);
    if (!category) throw new BadRequestException('Danh mục không tồn tại');
    if (!brand) throw new BadRequestException('Thương hiệu không tồn tại');
  }
}
