import { Module } from '@nestjs/common';
import { EVENT_BUS } from './event-bus';
import { KafkaService } from './kafka.service';

/** Hạ tầng dùng chung, không phải module nghiệp vụ. Module cần publish/consume thì import KafkaModule. */
@Module({
  providers: [KafkaService, { provide: EVENT_BUS, useExisting: KafkaService }],
  exports: [KafkaService, EVENT_BUS],
})
export class KafkaModule {}
