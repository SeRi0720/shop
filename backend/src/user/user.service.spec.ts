import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UserService } from './user.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 5,
  email: 'a@x.test',
  fullName: 'A',
  phone: null,
  role: 'USER',
  isActive: true,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  passwordHash: 'SECRET', // mô phỏng DB lỡ trả thừa
  ...over,
});

describe('UserService (khóa tài khoản)', () => {
  const user = {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  };
  const prisma = {
    user,
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const service = new UserService(prisma as unknown as PrismaService);

  beforeEach(() => {
    Object.values(user).forEach((f) => f.mockReset());
    user.count.mockResolvedValue(0);
    user.findMany.mockResolvedValue([]);
  });

  describe('setActive', () => {
    it('id không có: 404, không ghi', async () => {
      user.findUnique.mockResolvedValue(null);
      await expect(service.setActive(1, false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(user.update).not.toHaveBeenCalled();
    });

    it('mục tiêu ADMIN: 409, không ghi', async () => {
      user.findUnique.mockResolvedValue(row({ role: 'ADMIN' }));
      await expect(service.setActive(5, false)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(user.update).not.toHaveBeenCalled();
    });

    it('khóa người đã bị khóa: idempotent, không ghi', async () => {
      user.findUnique.mockResolvedValue(row({ isActive: false }));
      const res = await service.setActive(5, false);
      expect(res.isActive).toBe(false);
      expect(user.update).not.toHaveBeenCalled();
    });

    it('khóa USER đang hoạt động: ghi đúng và không lộ passwordHash', async () => {
      user.findUnique.mockResolvedValue(row());
      user.update.mockResolvedValue(row({ isActive: false }));
      const res = await service.setActive(5, false);
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: { isActive: false },
        }),
      );
      expect(res.isActive).toBe(false);
      expect(res).not.toHaveProperty('passwordHash');
    });
  });

  describe('listForAdmin', () => {
    const lastWhere = () => user.findMany.mock.calls[0][0].where;

    it('escape % và _ trong q', async () => {
      await service.listForAdmin({ q: '50%_' });
      expect(lastWhere().OR[0].email.contains).toBe('50\\%\\_');
      expect(lastWhere().OR).toHaveLength(3);
    });

    it('lọc status', async () => {
      await service.listForAdmin({ status: 'locked' });
      expect(lastWhere().isActive).toBe(false);
      user.findMany.mockClear();
      await service.listForAdmin({ status: 'active' });
      expect(lastWhere().isActive).toBe(true);
      user.findMany.mockClear();
      await service.listForAdmin({});
      expect(lastWhere().isActive).toBeUndefined();
    });

    it('sắp createdAt rồi id giảm dần, phân trang, không lộ passwordHash', async () => {
      user.count.mockResolvedValue(45);
      user.findMany.mockResolvedValue([row()]);
      const res = await service.listForAdmin({ page: 3, limit: 20 });
      expect(user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: 40,
          take: 20,
        }),
      );
      expect(res).toMatchObject({
        total: 45,
        page: 3,
        limit: 20,
        totalPages: 3,
      });
      expect(res.items[0]).not.toHaveProperty('passwordHash');
    });
  });

  it('DTO truy vấn: limit > 50 bị từ chối', async () => {
    const dto = plainToInstance(AdminUserQueryDto, { limit: '51' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
