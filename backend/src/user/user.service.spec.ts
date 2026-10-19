import type { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';

describe('UserService.findSummariesByIds', () => {
  const setup = () => {
    const prisma = { user: { findMany: jest.fn() } };
    return {
      prisma,
      service: new UserService(prisma as unknown as PrismaService),
    };
  };

  it('danh sách rỗng: không truy vấn', async () => {
    const { service, prisma } = setup();
    expect((await service.findSummariesByIds([])).size).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('một truy vấn cho nhiều id, trả Map theo id', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([
      { id: 2, fullName: 'Bình', email: 'b@x.vn' },
      { id: 3, fullName: 'Cường', email: 'c@x.vn' },
    ]);
    const map = await service.findSummariesByIds([2, 3]);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(map.get(3)?.fullName).toBe('Cường');
  });
});
