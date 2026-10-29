import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { CacheStore } from './cache.types';
import { readRedisConfig, type RedisConfig } from './redis.config';
import { throttledWarn } from './throttled-warn';

@Injectable()
export class RedisService
  implements CacheStore, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisService.name);
  private readonly warn = throttledWarn(this.logger);
  readonly cfg: RedisConfig;
  private client?: Redis;
  private ready = false;

  constructor(config: ConfigService) {
    this.cfg = readRedisConfig({
      REDIS_ENABLED: config.get<string>('REDIS_ENABLED'),
      REDIS_URL: config.get<string>('REDIS_URL'),
      CACHE_ENABLED: config.get<string>('CACHE_ENABLED'),
      DATABASE_POOL_MAX: config.get<string>('DATABASE_POOL_MAX'),
    });
  }

  get enabled(): boolean {
    return this.cfg.enabled && this.cfg.cacheEnabled;
  }

  /** Ngày 4: /api/health đọc cờ này, không gọi Redis mỗi lần. */
  get isReady(): boolean {
    return this.ready;
  }

  onApplicationBootstrap(): void {
    if (!this.cfg.enabled) {
      this.logger.log('REDIS_ENABLED=false: không mở kết nối Redis');
      return;
    }
    // Tạo client là bắt đầu nối ngay, KHÔNG await: backend không chờ hay sập vì Redis.
    const client = new Redis(this.cfg.url, {
      protocol: 2,
      enableOfflineQueue: false, // chưa nối thì lệnh lỗi ngay, không xếp hàng làm request chậm
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 500, // Redis treo thì không kéo request chậm theo
      retryStrategy: (times) => Math.min(times * 500, 10_000), // tự nối lại mãi
    });
    client.on('ready', () => {
      this.ready = true;
      this.logger.log('Redis sẵn sàng');
    });
    client.on('close', () => {
      this.ready = false;
    });
    client.on('error', (e: Error) => this.warn(`Redis lỗi: ${e.message}`));
    this.client = client;
  }

  onApplicationShutdown(): void {
    this.client?.disconnect();
  }

  /** Ngày 4: adapter Socket.IO cần client riêng cho pub và sub. */
  duplicate(): Redis {
    if (!this.client) throw new Error('Redis chưa khởi tạo');
    return this.client.duplicate();
  }

  private cmd(): Redis {
    if (!this.client || !this.ready) throw new Error('Redis chưa sẵn sàng');
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.cmd().get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.cmd().set(key, value, 'EX', ttlSeconds);
  }

  async incr(key: string): Promise<number> {
    return this.cmd().incr(key);
  }
}
