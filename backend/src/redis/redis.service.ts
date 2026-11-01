import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { CacheStore } from './cache.types';
import { readRedisConfig, type RedisConfig } from './redis.config';
import { swallowRejections } from './swallow-rejections';
import { throttledWarn } from './throttled-warn';

@Injectable()
export class RedisService implements CacheStore, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly warn = throttledWarn(this.logger);
  readonly cfg: RedisConfig;
  private client?: Redis;
  private readonly extra: Redis[] = [];
  private ready = false;

  constructor(config: ConfigService) {
    this.cfg = readRedisConfig({
      REDIS_ENABLED: config.get<string>('REDIS_ENABLED'),
      REDIS_URL: config.get<string>('REDIS_URL'),
      CACHE_ENABLED: config.get<string>('CACHE_ENABLED'),
      DATABASE_POOL_MAX: config.get<string>('DATABASE_POOL_MAX'),
    });
    if (!this.cfg.enabled) {
      this.logger.log('REDIS_ENABLED=false: không mở kết nối Redis');
      return;
    }
    // Mở ngay trong constructor (không phải onApplicationBootstrap): gateway Socket.IO được
    // tạo TRƯỚC các hook khởi động, và adapter cần client lúc đó. Không await: Redis chết
    // thì backend vẫn khởi động (fail-open), ioredis tự nối lại.
    this.client = this.open();
  }

  get enabled(): boolean {
    return this.cfg.enabled && this.cfg.cacheEnabled;
  }

  /** /api/health đọc cờ này, không gọi Redis mỗi lần. */
  get isReady(): boolean {
    return this.ready;
  }

  private open(): Redis {
    const client = new Redis(this.cfg.url, {
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
    return client;
  }

  /**
   * Hai client riêng cho adapter Socket.IO.
   * - pub: giữ enableOfflineQueue=false (kế thừa), nên tin phát lúc Redis chết bị BỎ chứ không
   *   xếp hàng trong bộ nhớ; lỗi được nuốt để không thành unhandledRejection.
   * - sub: PHẢI xếp hàng được, vì lệnh SUBSCRIBE gửi lúc khởi động khi Redis chưa lên phải
   *   chạy khi nối được (đã thử: nếu không, phát chéo instance chết vĩnh viễn tới khi restart).
   */
  createPubSubPair(): { pub: Redis; sub: Redis } {
    if (!this.client)
      throw new Error('Redis chưa khởi tạo (REDIS_ENABLED=false?)');
    const pub = this.client.duplicate();
    const sub = this.client.duplicate({
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
      commandTimeout: undefined,
    });
    for (const c of [pub, sub]) {
      c.on('error', (e: Error) =>
        this.warn(`Redis (adapter) lỗi: ${e.message}`),
      );
    }
    const dropped = (e: unknown) =>
      this.warn(
        `Adapter Socket.IO: bỏ tin phát chéo instance (${e instanceof Error ? e.message : String(e)})`,
      );
    swallowRejections(pub, ['publish'], dropped);
    swallowRejections(sub, ['subscribe', 'psubscribe'], dropped);
    this.extra.push(pub, sub);
    return { pub, sub };
  }

  onApplicationShutdown(): void {
    this.client?.disconnect();
    for (const c of this.extra) c.disconnect();
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
