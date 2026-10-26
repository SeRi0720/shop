import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EVENT_BUS } from './event-bus';
import { IdempotencyService } from './idempotency.service';
import { ProcessedEventsCleaner } from './processed-events-cleaner';
import { KafkaService } from './kafka.service';

/** Hạ tầng dùng chung, không phải module nghiệp vụ. Sở hữu bảng processed_events. */
@Module({
  imports: [PrismaModule],
  providers: [
    KafkaService,
    IdempotencyService,
    ProcessedEventsCleaner,
    { provide: EVENT_BUS, useExisting: KafkaService },
  ],
  exports: [KafkaService, IdempotencyService, EVENT_BUS],
})
export class KafkaModule {}
