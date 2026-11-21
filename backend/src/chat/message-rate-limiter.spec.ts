import { Logger } from '@nestjs/common';
import { FakeCounterStore } from '../redis/testing/fake-counter-store';
import { MessageRateLimiter } from './message-rate-limiter';

describe('MessageRateLimiter', () => {
  let t: number;
  let store: FakeCounterStore;
  let warn: jest.SpyInstance;

  const backend = () => new MessageRateLimiter(10, 10_000, store, () => t);

  const send = async (
    limiter: MessageRateLimiter,
    userId: number,
    n: number,
  ) => {
    const results: boolean[] = [];
    for (let i = 0; i < n; i++) results.push(await limiter.tryConsume(userId));
    return results;
  };

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    t = 0;
    store = new FakeCounterStore(() => t);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('Redis hoạt động', () => {
    it('tin thứ 11 trong cửa sổ bị chặn, hết cửa sổ gửi lại được', async () => {
      const limiter = backend();
      expect(await send(limiter, 1, 10)).toEqual(Array(10).fill(true));
      expect(await limiter.tryConsume(1)).toBe(false);
      t = 9_999;
      expect(await limiter.tryConsume(1)).toBe(false);
      t = 10_000;
      expect(await limiter.tryConsume(1)).toBe(true);
    });

    it('hai backend dùng chung bộ đếm: 6 tin ở A + 4 tin ở B đã đủ 10, tin kế tiếp ở đâu cũng bị chặn', async () => {
      const a = backend();
      const b = backend();
      expect(await send(a, 1, 6)).toEqual(Array(6).fill(true));
      expect(await send(b, 1, 4)).toEqual(Array(4).fill(true));
      expect(await b.tryConsume(1)).toBe(false);
      expect(await a.tryConsume(1)).toBe(false);
    });

    it('hai người dùng không ảnh hưởng nhau', async () => {
      const limiter = backend();
      await send(limiter, 1, 10);
      expect(await limiter.tryConsume(1)).toBe(false);
      expect(await limiter.tryConsume(2)).toBe(true);
    });

    it('ghi đúng khóa theo userId và đúng độ dài cửa sổ', async () => {
      await backend().tryConsume(7);
      expect(store.keys()).toEqual(['rl:chat:7']);
      expect(store.lastWindowMs).toBe(10_000);
    });

    it('không dùng bộ đếm cục bộ khi Redis ổn (không đếm hai lần)', async () => {
      const limiter = backend();
      await send(limiter, 1, 10);
      expect(store.count('rl:chat:1')).toBe(10);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('Redis lỗi: fail-open, không ném lỗi, không khóa người dùng', () => {
    it('lượt đầu khi Redis chết vẫn được gửi (không ném lỗi), có ghi cảnh báo', async () => {
      store.fail = true;
      await expect(backend().tryConsume(1)).resolves.toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('vẫn còn giới hạn nhờ bộ đếm cục bộ: tin thứ 11 bị chặn, cảnh báo không lặp mỗi request', async () => {
      store.fail = true;
      const limiter = backend();
      expect(await send(limiter, 1, 10)).toEqual(Array(10).fill(true));
      expect(await limiter.tryConsume(1)).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('Redis hồi phục thì quay lại dùng bộ đếm chung', async () => {
      const limiter = backend();
      store.fail = true;
      await send(limiter, 1, 3);
      store.fail = false;
      expect(await limiter.tryConsume(1)).toBe(true);
      expect(store.count('rl:chat:1')).toBe(1);
    });
  });

  describe('không có Redis dùng chung', () => {
    it('countersEnabled=false (REDIS_ENABLED=false): đếm cục bộ, không gọi store', async () => {
      store.countersEnabled = false;
      const limiter = backend();
      expect(await send(limiter, 1, 10)).toEqual(Array(10).fill(true));
      expect(await limiter.tryConsume(1)).toBe(false);
      expect(store.calls).toBe(0);
      expect(warn).not.toHaveBeenCalled();
    });

    it('không truyền store (cách e2e dựng): đếm cục bộ theo hạn mức đã cho', async () => {
      const limiter = new MessageRateLimiter(2, 10_000);
      expect(await send(limiter, 1, 2)).toEqual([true, true]);
      expect(await limiter.tryConsume(1)).toBe(false);
    });
  });
});
