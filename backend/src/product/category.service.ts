import { ConflictException, Injectable } from '@nestjs/common';
import { toHttpException } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CATEGORIES_SCOPE, CATALOG_TTL } from './product-cache';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  findAll() {
    return this.cache.getOrSet(CATEGORIES_SCOPE, CATALOG_TTL.taxonomy, () =>
      this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async create(name: string) {
    try {
      const row = await this.prisma.category.create({ data: { name } });
      await this.cache.bump(); // SAU khi ghi DB xong
      return row;
    } catch (error) {
      throw toHttpException(error, 'Danh mục');
    }
  }

  async update(id: number, name: string) {
    try {
      const row = await this.prisma.category.update({
        where: { id },
        data: { name },
      });
      await this.cache.bump(); // đổi tên làm đổi cả danh sách sản phẩm (có category.name)
      return row;
    } catch (error) {
      throw toHttpException(error, 'Danh mục');
    }
  }

  async remove(id: number) {
    // Không lọc isActive: sản phẩm ẩn vẫn giữ khóa ngoại.
    const count = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (count > 0) {
      throw new ConflictException('Danh mục còn sản phẩm, không thể xóa');
    }
    try {
      await this.prisma.category.delete({ where: { id } });
      await this.cache.bump();
    } catch (error) {
      throw toHttpException(error, 'Danh mục'); // bắt P2003 nếu có race
    }
  }
}
