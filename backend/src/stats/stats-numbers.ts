/** SUM/COUNT từ $queryRaw có thể là bigint; JSON.stringify ném lỗi với bigint. */
export function toNumber(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError('Giá trị vượt phạm vi số nguyên an toàn');
  }
  return Number(value);
}

export type NumberifyBigInt<T> = {
  [K in keyof T]: T[K] extends bigint ? number : T[K];
};

export function numberifyRow<T extends object>(row: T): NumberifyBigInt<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row))
    out[k] = typeof v === 'bigint' ? toNumber(v) : v;
  return out as NumberifyBigInt<T>;
}
