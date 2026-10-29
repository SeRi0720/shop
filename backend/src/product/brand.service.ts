import { ConflictException, Injectable } from '@nestjs/common';
import { toHttpException } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { BRANDS_SCOPE, CATALOG_TTL } from './product-cache';

@Injectable()
export class BrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  findAll() {
    return this.cache.getOrSet(BRANDS_SCOPE, CATALOG_TTL.taxonomy, () =>
      this.prisma.brand.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async create(name: string) {
    try {
      const row = await this.prisma.brand.create({ data: { name } });
      await this.cache.bump(); // SAU khi ghi DB xong
      return row;
    } catch (error) {
      throw toHttpException(error, 'Thương hiệu');
    }
  }

  async update(id: number, name: string) {
    try {
      const row = await this.prisma.brand.update({
        where: { id },
        data: { name },
      });
      await this.cache.bump(); // đổi tên làm đổi cả danh sách sản phẩm (có brand.name)
      return row;
    } catch (error) {
      throw toHttpException(error, 'Thương hiệu');
    }
  }

  async remove(id: number) {
    // Không lọc isActive: sản phẩm ẩn vẫn giữ khóa ngoại.
    const count = await this.prisma.product.count({
      where: { brandId: id },
    });
    if (count > 0) {
      throw new ConflictException('Thương hiệu còn sản phẩm, không thể xóa');
    }
    try {
      await this.prisma.brand.delete({ where: { id } });
      await this.cache.bump();
    } catch (error) {
      throw toHttpException(error, 'Thương hiệu'); // bắt P2003 nếu có race
    }
  }
}
