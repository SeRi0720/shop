import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export const RETENTION_DAYS = 14; // lâu hơn retention 7 ngày của topic (quyết định 8)
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProcessedEventsCleaner {
  private readonly logger = new Logger(ProcessedEventsCleaner.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    try {
      const deleted = await this.cleanup(new Date());
      if (deleted > 0) this.logger.log(`Dọn processed_events: xóa ${deleted} bản ghi`);
    } catch (error) {
      this.logger.error(`Dọn processed_events lỗi: ${String(error)}`);
    }
  }

  /** Nhận `now` để test bằng đồng hồ giả; nhiều instance cùng chạy cũng vô hại. */
  async cleanup(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
    const { count } = await this.prisma.processedEvent.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    return count;
  }
}
