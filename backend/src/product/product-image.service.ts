import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from './product.service';
import {
  IMAGE_EXT,
  MAX_IMAGES_PER_PRODUCT,
  UPLOAD_URL_PREFIX,
  getUploadDir,
  type UploadedImage,
} from './upload.config';

const MAX_INT = 2_147_483_647;

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async addImages(productId: number, files: UploadedImage[]) {
    if (files.length === 0) throw new BadRequestException('Chưa chọn file nào');

    // 404 nếu không có sản phẩm (đã có sẵn chặn id > MAX_INT). Làm TRƯỚC khi ghi file.
    await this.productService.findOne(productId, true);

    const existing = await this.prisma.productImage.count({
      where: { productId },
    });
    if (existing + files.length > MAX_IMAGES_PER_PRODUCT) {
      throw new BadRequestException(
        `Mỗi sản phẩm tối đa ${MAX_IMAGES_PER_PRODUCT} ảnh (hiện có ${existing})`,
      );
    }

    // Tên do server sinh, đuôi lấy từ mimetype; không bao giờ dùng originalname.
    const names = files.map((f) => {
      const ext = IMAGE_EXT[f.mimetype];
      if (!ext) throw new BadRequestException('Chỉ nhận ảnh jpeg, png, webp');
      return `${randomUUID()}${ext}`;
    });

    const dir = getUploadDir();
    await mkdir(dir, { recursive: true });

    const written: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        await writeFile(join(dir, names[i]), file.buffer);
        written.push(names[i]);
      }
      // `return await` (không bỏ await) để lỗi DB bị catch bên dưới và dọn file.
      return await this.prisma.$transaction(
        names.map((name, i) =>
          this.prisma.productImage.create({
            data: {
              productId,
              url: `${UPLOAD_URL_PREFIX}/${name}`,
              sortOrder: existing + i,
            },
            select: { id: true, url: true, sortOrder: true },
          }),
        ),
      );
    } catch (error) {
      await Promise.allSettled(written.map((n) => unlink(join(dir, n))));
      throw error;
    }
  }

  async removeImage(productId: number, imageId: number) {
    const image =
      productId > MAX_INT || imageId > MAX_INT
        ? null
        : await this.prisma.productImage.findFirst({
            where: { id: imageId, productId }, // ảnh phải thuộc đúng sản phẩm
          });
    if (!image) throw new NotFoundException('Không tìm thấy ảnh');

    // Xóa DB trước, file sau: nếu xóa file lỗi chỉ còn file mồ côi vô hại,
    // còn làm ngược lại thì có thể để lại dòng DB trỏ tới ảnh không tồn tại.
    await this.prisma.productImage.delete({ where: { id: image.id } });
    try {
      await unlink(join(getUploadDir(), basename(image.url)));
    } catch (error) {
      this.logger.warn(`Không xóa được file ${image.url}: ${String(error)}`);
    }
  }
}
