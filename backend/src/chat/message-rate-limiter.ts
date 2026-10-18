/** Cửa sổ trượt trong bộ nhớ, đếm theo userId (gộp mọi socket của người đó). */
export class MessageRateLimiter {
  private readonly hits = new Map<number, number[]>();
  private lastSweep: number;

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 10_000,
    private readonly now: () => number = Date.now,
  ) {
    this.lastSweep = now();
  }

  /** true nếu được gửi (và ghi nhận lượt này), false nếu vượt giới hạn. */
  tryConsume(userId: number): boolean {
    const t = this.now();
    this.sweepIfDue(t);
    const recent = (this.hits.get(userId) ?? []).filter(
      (ts) => ts > t - this.windowMs,
    );
    if (recent.length >= this.limit) {
      this.hits.set(userId, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(userId, recent);
    return true;
  }

  get trackedUsers(): number {
    return this.hits.size;
  }

  /** Mỗi cửa sổ dọn một lần: người đã im quá một cửa sổ thì xóa khỏi Map. */
  private sweepIfDue(t: number) {
    if (t - this.lastSweep < this.windowMs) return;
    this.lastSweep = t;
    for (const [id, stamps] of this.hits) {
      if (stamps.every((ts) => ts <= t - this.windowMs)) this.hits.delete(id);
    }
  }
}
