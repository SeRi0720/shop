import { Test } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  type Type,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';

interface Svc {
  findAll(): unknown;
  create(name: string): Promise<unknown>;
  update(id: number, name: string): Promise<unknown>;
  remove(id: number): Promise<void>;
}

interface Case {
  name: string;
  Service: Type<Svc>;
  model: 'brand' | 'category';
  fk: 'brandId' | 'categoryId';
  label: string;
}

const cases: Case[] = [
  {
    name: 'BrandService',
    Service: BrandService,
    model: 'brand',
    fk: 'brandId',
    label: 'Thương hiệu',
  },
  {
    name: 'CategoryService',
    Service: CategoryService,
    model: 'category',
    fk: 'categoryId',
    label: 'Danh mục',
  },
];

// Lỗi giả lập có `code` giống lỗi Prisma
const prismaError = (code: string) =>
  Object.assign(new Error(`prisma ${code}`), { code });

const makeModel = () => ({
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const makePrisma = () => ({
  brand: makeModel(),
  category: makeModel(),
  product: { count: jest.fn().mockResolvedValue(0) },
});

describe.each(cases)('$name', ({ Service, model, fk, label }) => {
  let service: Svc;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [Service, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(Service);
  });

  describe('findAll', () => {
    it('sắp xếp theo tên tăng dần', async () => {
      prisma[model].findMany.mockResolvedValue([]);
      await service.findAll();
      expect(prisma[model].findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('tạo thành công và trả về bản ghi', async () => {
      prisma[model].create.mockResolvedValue({ id: 1, name: 'X' });
      await expect(service.create('X')).resolves.toEqual({ id: 1, name: 'X' });
      expect(prisma[model].create).toHaveBeenCalledWith({
        data: { name: 'X' },
      });
    });

    it('tên trùng (P2002) trả 409 kèm thông báo rõ', async () => {
      prisma[model].create.mockRejectedValue(prismaError('P2002'));
      const promise = service.create('X');
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(`${label} đã tồn tại`);
    });

    it('lỗi lạ được ném lại nguyên vẹn, không bị nuốt thành 409', async () => {
      const err = new Error('boom');
      prisma[model].create.mockRejectedValue(err);
      await expect(service.create('X')).rejects.toBe(err);
    });
  });

  describe('update', () => {
    it('cập nhật thành công', async () => {
      prisma[model].update.mockResolvedValue({ id: 3, name: 'Y' });
      await expect(service.update(3, 'Y')).resolves.toEqual({
        id: 3,
        name: 'Y',
      });
      expect(prisma[model].update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { name: 'Y' },
      });
    });

    it('đổi sang tên đã có (P2002) trả 409', async () => {
      prisma[model].update.mockRejectedValue(prismaError('P2002'));
      await expect(service.update(3, 'Y')).rejects.toThrow(ConflictException);
    });

    it('id không tồn tại (P2025) trả 404', async () => {
      prisma[model].update.mockRejectedValue(prismaError('P2025'));
      await expect(service.update(3, 'Y')).rejects.toThrow(NotFoundException);
    });

    it('lỗi lạ được ném lại nguyên vẹn', async () => {
      const err = new Error('boom');
      prisma[model].update.mockRejectedValue(err);
      await expect(service.update(3, 'Y')).rejects.toBe(err);
    });
  });

  describe('remove', () => {
    it('còn sản phẩm: 409, không xóa; đếm KHÔNG lọc isActive (tính cả sản phẩm ẩn)', async () => {
      prisma.product.count.mockResolvedValue(1);
      await expect(service.remove(3)).rejects.toThrow(ConflictException);
      // Khớp chính xác: nếu code thêm `isActive: true` vào where thì ca này đỏ
      expect(prisma.product.count).toHaveBeenCalledWith({
        where: { [fk]: 3 },
      });
      expect(prisma[model].delete).not.toHaveBeenCalled();
    });

    it('thông báo 409 nêu rõ còn sản phẩm', async () => {
      prisma.product.count.mockResolvedValue(2);
      await expect(service.remove(3)).rejects.toThrow('còn sản phẩm');
    });

    it('không còn sản phẩm: xóa thành công', async () => {
      prisma.product.count.mockResolvedValue(0);
      prisma[model].delete.mockResolvedValue({ id: 3 });
      await expect(service.remove(3)).resolves.toBeUndefined();
      expect(prisma[model].delete).toHaveBeenCalledWith({ where: { id: 3 } });
    });

    it('race condition: count=0 nhưng delete bị khóa ngoại (P2003) vẫn trả 409, không phải 500', async () => {
      prisma.product.count.mockResolvedValue(0);
      prisma[model].delete.mockRejectedValue(prismaError('P2003'));
      await expect(service.remove(3)).rejects.toThrow(ConflictException);
    });

    it('xóa id không tồn tại (P2025) trả 404', async () => {
      prisma.product.count.mockResolvedValue(0);
      prisma[model].delete.mockRejectedValue(prismaError('P2025'));
      await expect(service.remove(3)).rejects.toThrow(NotFoundException);
    });

    it('lỗi lạ khi xóa được ném lại nguyên vẹn', async () => {
      const err = new Error('boom');
      prisma.product.count.mockResolvedValue(0);
      prisma[model].delete.mockRejectedValue(err);
      await expect(service.remove(3)).rejects.toBe(err);
    });
  });
});
