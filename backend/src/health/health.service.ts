import { Injectable } from '@nestjs/common';
import { KafkaService } from '../kafka/kafka.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export const DB_TIMEOUT_MS = 2_000;

export type ComponentStatus = 'ok' | 'down' | 'disabled';

export interface HealthBody {
  status: 'ok' | 'degraded' | 'down';
  db: 'ok' | 'down';
  redis: ComponentStatus;
  kafka: ComponentStatus;
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly kafka: KafkaService,
  ) {}

  /** healthy=false chỉ khi DB lỗi. Redis và Kafka là thành phần phụ (fail-open): chỉ báo, không đổi mã HTTP. */
  async check(): Promise<{ healthy: boolean; body: HealthBody }> {
    const dbOk = await this.dbOk();
    const redis: ComponentStatus = !this.redis.cfg.enabled
      ? 'disabled'
      : this.redis.isReady
        ? 'ok'
        : 'down';
    const kafka: ComponentStatus = !this.kafka.cfg.enabled
      ? 'disabled'
      : this.kafka.isReady
        ? 'ok'
        : 'down';
    const status = !dbOk
      ? 'down'
      : redis === 'down' || kafka === 'down'
        ? 'degraded'
        : 'ok';
    return {
      healthy: dbOk,
      // Không địa chỉ, không phiên bản, không thông báo lỗi.
      body: {
        status,
        db: dbOk ? 'ok' : 'down',
        redis,
        kafka,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  private async dbOk(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
