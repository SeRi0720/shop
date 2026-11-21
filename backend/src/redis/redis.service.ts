import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { CacheStore, CounterStore } from './cache.types';
import { readRedisConfig, type RedisConfig } from './redis.config';
import { swallowRejections } from './swallow-rejections';
import { throttledWarn } from './throttled-warn';

const HIT_WINDOW_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return n
`;

@Injectable()
export class RedisService
  implements CacheStore, CounterStore, OnApplicationShutdown
{
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
    this.client = this.open();
  }

  get enabled(): boolean {
    return this.cfg.enabled && this.cfg.cacheEnabled;
  }

  get countersEnabled(): boolean {
    return this.cfg.enabled;
  }

  get isReady(): boolean {
    return this.ready;
  }

  private open(): Redis {
    const client = new Redis(this.cfg.url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 500,
      retryStrategy: (times) => Math.min(times * 500, 10_000),
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

  async hitWindow(key: string, windowMs: number): Promise<number> {
    const result = await this.cmd().eval(HIT_WINDOW_LUA, 1, key, windowMs);
    const count = Number(result);
    if (!Number.isInteger(count)) {
      throw new Error(`Redis trả giá trị không hợp lệ cho ${key}`);
    }
    return count;
  }
}
