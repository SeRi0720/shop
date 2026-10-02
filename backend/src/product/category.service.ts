import { ConflictException, Injectable } from '@nestjs/common';
import { toHttpException } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string) {
    try {
      return await this.prisma.category.create({ data: { name } });
    } catch (error) {
      throw toHttpException(error, 'Danh mục');
    }
  }

  async update(id: number, name: string) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { name },
      });
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
    } catch (error) {
      throw toHttpException(error, 'Danh mục'); // bắt P2003 nếu có race
    }
  }
}
