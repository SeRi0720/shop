import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductImageService } from './product-image.service';
import { ProductService } from './product.service';
import { imageFileFilter, imageUploadOptions } from './upload.config';

const img = (mimetype = 'image/png', originalname = 'a.png') => ({
  buffer: Buffer.from('x'),
  mimetype,
  size: 1,
  originalname,
});

const makePrisma = () => ({
  productImage: {
    count: jest.fn().mockResolvedValue(0),
    create: jest
      .fn()
      .mockImplementation(async ({ data }: { data: object }) => ({
        id: 1,
        ...data,
      })),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
});

describe('ProductImageService', () => {
  let service: ProductImageService;
  let prisma: ReturnType<typeof makePrisma>;
  let productService: { findOne: jest.Mock };
  let dir: string;

  beforeEach(async () => {
    // Thư mục tạm thật để chứng minh "không để lại file" bằng readdir
    dir = await mkdtemp(join(tmpdir(), 'shop-uploads-'));
    process.env.UPLOAD_DIR = dir;
    prisma = makePrisma();
    productService = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductImageService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: productService },
      ],
    }).compile();
    service = moduleRef.get(ProductImageService);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  describe('addImages', () => {
    it('tên ngẫu nhiên, đuôi theo mimetype, sortOrder nối tiếp', async () => {
      prisma.productImage.count.mockResolvedValue(1);
      const res = await service.addImages(1, [
        img('image/png', '../../evil.php'),
        img('image/jpeg', 'b.jpg'),
      ]);
      const names = await readdir(dir);
      expect(names).toHaveLength(2);
      expect(names.some((n) => n.includes('evil'))).toBe(false);
      expect(names.map((n) => extname(n)).sort()).toEqual(['.jpg', '.png']);
      expect(res.map((r) => r.sortOrder)).toEqual([1, 2]);
      expect(res.every((r) => r.url.startsWith('/api/uploads/'))).toBe(true);
    });

    it('sản phẩm không tồn tại: 404, không ghi file, không chạm DB', async () => {
      productService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.addImages(999, [img()])).rejects.toThrow(
        NotFoundException,
      );
      expect(await readdir(dir)).toEqual([]);
      expect(prisma.productImage.create).not.toHaveBeenCalled();
    });

    it('vượt 8 ảnh bị từ chối, không ghi file', async () => {
      prisma.productImage.count.mockResolvedValue(7);
      await expect(service.addImages(1, [img(), img()])).rejects.toThrow(
        BadRequestException,
      );
      expect(await readdir(dir)).toEqual([]);
    });

    it('đúng 8 ảnh thì được (biên)', async () => {
      prisma.productImage.count.mockResolvedValue(6);
      await expect(service.addImages(1, [img(), img()])).resolves.toHaveLength(
        2,
      );
    });

    it('ghi DB lỗi thì xóa các file vừa ghi', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db down'));
      await expect(service.addImages(1, [img(), img()])).rejects.toThrow(
        'db down',
      );
      expect(await readdir(dir)).toEqual([]);
    });

    it('mimetype lạ bị từ chối ngay trong service', async () => {
      await expect(
        service.addImages(1, [img('application/pdf', 'a.pdf')]),
      ).rejects.toThrow(BadRequestException);
      expect(await readdir(dir)).toEqual([]);
    });
  });

  describe('removeImage', () => {
    const row = { id: 5, productId: 1, url: '/api/uploads/x.png' };

    it('xóa dòng DB và file', async () => {
      await writeFile(join(dir, 'x.png'), 'x');
      prisma.productImage.findFirst.mockResolvedValue(row);
      await service.removeImage(1, 5);
      expect(prisma.productImage.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(await readdir(dir)).toEqual([]);
    });

    it('file đã mất vẫn không lỗi', async () => {
      prisma.productImage.findFirst.mockResolvedValue(row);
      await expect(service.removeImage(1, 5)).resolves.toBeUndefined();
    });

    it('ảnh không thuộc sản phẩm: 404, không xóa gì', async () => {
      prisma.productImage.findFirst.mockResolvedValue(null);
      await expect(service.removeImage(1, 5)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.productImage.delete).not.toHaveBeenCalled();
    });

    it('id quá lớn: 404 và không gọi DB', async () => {
      await expect(service.removeImage(1, 2_147_483_648)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.productImage.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('upload config', () => {
    it('bộ lọc từ chối pdf, nhận webp', () => {
      const cb = jest.fn();
      imageFileFilter({}, { mimetype: 'application/pdf' }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);
      cb.mockClear();
      imageFileFilter({}, { mimetype: 'image/webp' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    // Giới hạn 2 MB do Multer thực thi; Jest chỉ kiểm tra cấu hình,
    // việc thực thi đã kiểm bằng Swagger ở bước 4.
    it('giới hạn 2 MB / 5 file', () => {
      expect(imageUploadOptions.limits).toEqual({
        fileSize: 2 * 1024 * 1024,
        files: 5,
      });
    });
  });
});
