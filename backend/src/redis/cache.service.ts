import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_STORE, type CacheStore } from './cache.types';
import { throttledWarn } from './throttled-warn';

const VERSION_KEY = 'cache:catalog:ver';

const NULL_STORE: CacheStore = {
  enabled: false,
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
  incr: () => Promise.resolve(0),
};

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly warn = throttledWarn(this.logger);

  constructor(@Inject(CACHE_STORE) private readonly store: CacheStore) {}

  /** Cho e2e và script dựng service bằng tay: không bao giờ chạm Redis. */
  static disabled(): CacheService {
    return new CacheService(NULL_STORE);
  }

  /**
   * Thứ tự an toàn: đọc N, đọc DB, ghi dưới N đã đọc.
   * `load` ném lỗi (404, 400) thì không ghi cache, lỗi ném lại nguyên.
   */
  async getOrSet<T>(
    scope: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    if (!this.store.enabled) return load();

    const version = (await this.safe(() => this.store.get(VERSION_KEY))) ?? '0';
    const key = `cache:catalog:v${version}:${scope}`;

    const hit = await this.safe(() => this.store.get(key));
    if (hit !== null) {
      try {
        return JSON.parse(hit) as T;
      } catch {
        // giá trị hỏng: coi như trượt
      }
    }

    const value = await load();
    await this.safe(() =>
      this.store.set(key, JSON.stringify(value), ttlSeconds),
    );
    return value;
  }

  /** Gọi SAU khi ghi DB xong. Làm mọi khóa cũ vô hiệu bằng một INCR, không cần SCAN. */
  async bump(): Promise<void> {
    if (!this.store.enabled) return;
    await this.safe(() => this.store.incr(VERSION_KEY));
  }

  private async safe<T>(op: () => Promise<T>): Promise<T | null> {
    try {
      return await op();
    } catch (error) {
      this.warn(
        `Cache lỗi, bỏ qua: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
