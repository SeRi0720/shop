import type { CacheStore } from '../cache.types';

/** Bản giả của Redis trong bộ nhớ, dùng cho Jest. */
export class FakeCacheStore implements CacheStore {
  enabled = true;
  /** true thì mọi lệnh bị từ chối, như Redis chết. */
  fail = false;
  data = new Map<string, string>();
  ttls = new Map<string, number>();
  /** Thứ tự các khóa đã được get, để kiểm "đọc N trước khi đọc DB". */
  gets: string[] = [];

  get(key: string): Promise<string | null> {
    this.gets.push(key);
    if (this.fail) return Promise.reject(new Error('redis down'));
    return Promise.resolve(this.data.get(key) ?? null);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    this.data.set(key, value);
    this.ttls.set(key, ttlSeconds);
    return Promise.resolve();
  }

  incr(key: string): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const n = Number(this.data.get(key) ?? 0) + 1;
    this.data.set(key, String(n));
    return Promise.resolve(n);
  }

  /** Các khóa dữ liệu (không tính khóa phiên bản). */
  cacheKeys(): string[] {
    return [...this.data.keys()].filter((k) => k !== 'cache:catalog:ver');
  }
}
