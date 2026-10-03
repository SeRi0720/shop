import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { productInclude } from './product.include';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // Ngày 3 sẽ thay hàm này bằng hàm tìm kiếm dùng chung (có lọc, phân trang).
  async findAllAdmin() {
    const products = await this.prisma.product.findMany({
      include: productInclude,
      orderBy: { id: 'desc' },
    });
    return products.map((p) => ProductResponseDto.from(p));
  }

  async findOneAdmin(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
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
    await this.findOneAdmin(id); // 404 nếu không tồn tại
    await this.assertRefs(dto.categoryId, dto.brandId);
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: productInclude,
    });
    return ProductResponseDto.from(product);
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
