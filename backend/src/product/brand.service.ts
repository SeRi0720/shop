import { ConflictException, Injectable } from '@nestjs/common';
import { toHttpException } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string) {
    try {
      return await this.prisma.brand.create({ data: { name } });
    } catch (error) {
      throw toHttpException(error, 'Thương hiệu');
    }
  }

  async update(id: number, name: string) {
    try {
      return await this.prisma.brand.update({
        where: { id },
        data: { name },
      });
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
    } catch (error) {
      throw toHttpException(error, 'Thương hiệu'); // bắt P2003 nếu có race
    }
  }
}
