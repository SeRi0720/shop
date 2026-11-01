import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, KafkaModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
