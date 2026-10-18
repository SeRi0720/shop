import { MessageRateLimiter } from './message-rate-limiter';

describe('MessageRateLimiter', () => {
  let t: number;
  let limiter: MessageRateLimiter;
  beforeEach(() => {
    t = 0;
    limiter = new MessageRateLimiter(10, 10_000, () => t);
  });

  it('tin thứ 11 trong 10 giây bị chặn, qua 10 giây gửi lại được', () => {
    for (let i = 0; i < 10; i++) expect(limiter.tryConsume(1)).toBe(true);
    expect(limiter.tryConsume(1)).toBe(false);
    t = 9_999;
    expect(limiter.tryConsume(1)).toBe(false);
    t = 10_000;
    expect(limiter.tryConsume(1)).toBe(true);
  });

  it('cửa sổ trượt: chỉ lượt cũ hết hạn mới nhả chỗ', () => {
    for (let i = 0; i < 5; i++) limiter.tryConsume(1); // t=0
    t = 6_000;
    for (let i = 0; i < 5; i++) limiter.tryConsume(1);
    t = 9_000;
    expect(limiter.tryConsume(1)).toBe(false);
    t = 10_000; // 5 lượt đầu hết hạn
    for (let i = 0; i < 5; i++) expect(limiter.tryConsume(1)).toBe(true);
    expect(limiter.tryConsume(1)).toBe(false);
  });

  it('hai người dùng không ảnh hưởng nhau', () => {
    for (let i = 0; i < 10; i++) limiter.tryConsume(1);
    expect(limiter.tryConsume(1)).toBe(false);
    expect(limiter.tryConsume(2)).toBe(true);
  });

  it('dọn người dùng đã im lặng, bộ nhớ không phình', () => {
    limiter.tryConsume(1);
    limiter.tryConsume(2);
    limiter.tryConsume(3);
    expect(limiter.trackedUsers).toBe(3);
    t = 25_000;
    limiter.tryConsume(99);
    expect(limiter.trackedUsers).toBe(1);
  });
});
