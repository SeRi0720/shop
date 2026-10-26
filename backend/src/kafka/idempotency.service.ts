import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OnceResult = 'processed' | 'duplicate';

/**
 * Chống xử lý trùng bằng bảng processed_events (quyết định 8).
 * Ràng buộc duy nhất (consumer, event_id) của Postgres là trọng tài, đúng cả khi hai instance
 * cùng nhận một message. Thứ tự: GHI DẤU TRƯỚC, chạy hiệu ứng sau, lỗi thì XÓA dấu để retry.
 * Cửa sổ rủi ro còn lại: process chết đúng giữa hai bước thì mất một thông báo (đã chấp nhận).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runOnce(
    consumer: string,
    eventId: string,
    effect: () => Promise<void>,
  ): Promise<OnceResult> {
    // createMany + skipDuplicates = INSERT ... ON CONFLICT DO NOTHING; count 1 = thắng, 0 = đã có.
    const { count } = await this.prisma.processedEvent.createMany({
      data: [{ consumer, eventId }],
      skipDuplicates: true,
    });
    if (count === 0) {
      this.logger.log(`Bỏ qua trùng: consumer=${consumer} eventId=${eventId}`);
      return 'duplicate';
    }

    try {
      await effect();
      return 'processed';
    } catch (error) {
      // Bù trừ: gỡ dấu để lần giao lại (retry) chạy được hiệu ứng.
      await this.prisma.processedEvent
        .deleteMany({ where: { consumer, eventId } })
        .catch((e: unknown) =>
          this.logger.error(
            `Không gỡ được dấu ${consumer}/${eventId}: ${e instanceof Error ? e.message : String(e)}; sự kiện này có thể bị mất`,
          ),
        );
      throw error;
    }
  }
}
