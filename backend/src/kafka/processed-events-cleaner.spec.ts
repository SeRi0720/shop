import { describe, expect, it, jest } from '@jest/globals';
import {
  ProcessedEventsCleaner,
  RETENTION_DAYS,
} from './processed-events-cleaner';

const NOW = new Date('2026-11-20T03:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('ProcessedEventsCleaner', () => {
  it('xóa bản ghi cũ hơn đúng 14 ngày, tính từ now', async () => {
    const deleteMany = jest.fn(async (_args: unknown) => ({ count: 3 }));
    const cleaner = new ProcessedEventsCleaner({
      processedEvent: { deleteMany },
    } as never);
    expect(await cleaner.cleanup(NOW)).toBe(3);
    const arg = deleteMany.mock.calls[0][0] as {
      where: { processedAt: { lt: Date } };
    };
    expect(RETENTION_DAYS).toBe(14);
    expect(arg.where.processedAt.lt.getTime()).toBe(NOW.getTime() - 14 * DAY);
    // 14 ngày 1 giờ trước (bị xóa) < cutoff <= 13 ngày 23 giờ trước (được giữ)
    const cutoff = arg.where.processedAt.lt.getTime();
    expect(NOW.getTime() - (14 * DAY + 3_600_000)).toBeLessThan(cutoff);
    expect(NOW.getTime() - (14 * DAY - 3_600_000)).toBeGreaterThan(cutoff);
  });

  it('run() nuốt lỗi DB, không ném ra (cron không làm sập tiến trình)', async () => {
    const cleaner = new ProcessedEventsCleaner({
      processedEvent: {
        deleteMany: jest.fn(async () => {
          throw new Error('db');
        }),
      },
    } as never);
    await expect(cleaner.run()).resolves.toBeUndefined();
  });
});
