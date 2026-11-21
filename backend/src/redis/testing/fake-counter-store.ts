import type { CounterStore } from '../cache.types';

/** Bản giả của bộ đếm Redis trong bộ nhớ, có đồng hồ do test điều khiển. Dùng cho Jest. */
export class FakeCounterStore implements CounterStore {
  countersEnabled = true;
  /** true thì mọi lệnh bị từ chối, như Redis chết. */
  fail = false;
  /** Số lần hitWindow được gọi (kể cả lần lỗi). */
  calls = 0;
  lastWindowMs?: number;
  private readonly entries = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  hitWindow(key: string, windowMs: number): Promise<number> {
    this.calls++;
    this.lastWindowMs = windowMs;
    if (this.fail) return Promise.reject(new Error('redis down'));
    const t = this.now();
    const entry = this.entries.get(key);
    // Giống script Lua: lượt đầu mở cửa sổ, các lượt sau chỉ cộng, không gia hạn.
    if (!entry || entry.expiresAt <= t) {
      this.entries.set(key, { count: 1, expiresAt: t + windowMs });
      return Promise.resolve(1);
    }
    entry.count += 1;
    return Promise.resolve(entry.count);
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  count(key: string): number {
    return this.entries.get(key)?.count ?? 0;
  }
}
