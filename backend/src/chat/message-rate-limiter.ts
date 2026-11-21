import { Logger } from '@nestjs/common';
import type { CounterStore } from '../redis/cache.types';
import { throttledWarn } from '../redis/throttled-warn';
import { LocalWindowLimiter } from './local-window-limiter';

export const CHAT_RATE_LIMIT = 10;
export const CHAT_RATE_WINDOW_MS = 10_000;
const KEY_PREFIX = 'rl:chat:';

export class MessageRateLimiter {
  private readonly logger = new Logger(MessageRateLimiter.name);
  private readonly warn = throttledWarn(this.logger);
  private readonly local: LocalWindowLimiter;

  constructor(
    private readonly limit = CHAT_RATE_LIMIT,
    private readonly windowMs = CHAT_RATE_WINDOW_MS,
    private readonly store?: CounterStore,
    now: () => number = Date.now,
  ) {
    this.local = new LocalWindowLimiter(limit, windowMs, now);
  }

  async tryConsume(userId: number): Promise<boolean> {
    if (!this.store?.countersEnabled) return this.local.tryConsume(userId);
    try {
      const count = await this.store.hitWindow(
        `${KEY_PREFIX}${userId}`,
        this.windowMs,
      );
      return count <= this.limit;
    } catch (error) {
      this.warn(
        `Rate limit chat: Redis lỗi, dùng bộ đếm cục bộ (${error instanceof Error ? error.message : String(error)})`,
      );
      return this.local.tryConsume(userId);
    }
  }
}
