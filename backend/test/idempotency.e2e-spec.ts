import type { PrismaClient } from '../src/generated/prisma/client';
import { IdempotencyService } from '../src/kafka/idempotency.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestPrisma } from './helpers/test-db';

describe('IdempotencyService (PostgreSQL thật, bảng processed_events)', () => {
  let prisma: PrismaClient;
  let svc: IdempotencyService;

  beforeAll(async () => {
    prisma = await createTestPrisma(); // có chốt chặn: chỉ chạy trên database "test" cục bộ
    svc = new IdempotencyService(prisma as unknown as PrismaService);
  });
  beforeEach(async () => {
    await prisma.processedEvent.deleteMany();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cùng (consumer, eventId) hai lần: hiệu ứng chạy một lần', async () => {
    const fx = jest.fn(async () => undefined);
    expect(await svc.runOnce('c1', 'e1', fx)).toBe('processed');
    expect(await svc.runOnce('c1', 'e1', fx)).toBe('duplicate');
    expect(fx).toHaveBeenCalledTimes(1);
  });

  it('hiệu ứng lỗi lần đầu: dấu bị xóa, lần retry chạy lại hiệu ứng', async () => {
    await expect(
      svc.runOnce('c1', 'e2', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.processedEvent.count()).toBe(0);

    const fx = jest.fn(async () => undefined);
    expect(await svc.runOnce('c1', 'e2', fx)).toBe('processed');
    expect(fx).toHaveBeenCalledTimes(1);
  });

  it('5 lời gọi song song cùng eventId: đúng một hiệu ứng, một bản ghi', async () => {
    const fx = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 50)); // giữ hiệu ứng đủ lâu để các lời gọi chồng nhau
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => svc.runOnce('c1', 'e3', fx)),
    );
    expect(fx).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r === 'processed')).toHaveLength(1);
    expect(results.filter((r) => r === 'duplicate')).toHaveLength(4);
    expect(await prisma.processedEvent.count()).toBe(1);
  });

  it('cùng eventId nhưng consumer khác nhau: cả hai đều chạy', async () => {
    const fx = jest.fn(async () => undefined);
    await svc.runOnce('c1', 'e4', fx);
    await svc.runOnce('c2', 'e4', fx);
    expect(fx).toHaveBeenCalledTimes(2);
  });
});
