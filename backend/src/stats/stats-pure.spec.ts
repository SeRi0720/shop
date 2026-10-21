import { BadRequestException } from '@nestjs/common';
import { fillBuckets, listBucketKeys } from './stats-buckets';
import { numberifyRow, toNumber } from './stats-numbers';
import { resolveRange } from './stats-range';

describe('resolveRange', () => {
  const now = new Date('2026-10-20T10:00:00Z'); // 17:00 giờ VN, cùng ngày

  it('mặc định 30 ngày gần nhất tính tới hôm nay (giờ VN)', () => {
    const r = resolveRange({}, now);
    expect(r).toMatchObject({
      fromDay: '2026-09-21',
      toDay: '2026-10-20',
      granularity: 'day',
    });
    expect(r.from.toISOString()).toBe('2026-09-20T17:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-20T16:59:59.999Z');
  });

  it('qua nửa đêm giờ VN thì "hôm nay" sang ngày mới', () => {
    const r = resolveRange({}, new Date('2026-10-20T17:00:00Z')); // 00:00 ngày 21 giờ VN
    expect(r.toDay).toBe('2026-10-21');
  });

  it.each([
    ['from sau to', { from: '2026-10-10', to: '2026-10-01' }],
    ['ngày không có thật', { from: '2026-02-31', to: '2026-03-05' }],
    ['to không có thật', { to: '2026-13-01' }],
    ['sai định dạng', { from: '10/01/2026', to: '2026-10-05' }],
    ['ngày quá 366', { from: '2025-10-19', to: '2026-10-20' }],
    [
      'tháng quá 24',
      { from: '2024-10-01', to: '2026-10-31', granularity: 'month' as const },
    ],
  ])('từ chối: %s', (_name, input) => {
    expect(() => resolveRange(input, now)).toThrow(BadRequestException);
  });

  it('đúng giới hạn thì chấp nhận (366 ngày, 24 tháng)', () => {
    expect(() =>
      resolveRange({ from: '2025-10-20', to: '2026-10-20' }, now),
    ).not.toThrow();
    expect(() =>
      resolveRange(
        { from: '2024-11-01', to: '2026-10-31', granularity: 'month' },
        now,
      ),
    ).not.toThrow();
  });
});

describe('fillBuckets', () => {
  it('điền 0 cho ngày thiếu, giữ thứ tự tăng dần', () => {
    const out = fillBuckets(
      [{ key: '2026-10-02', revenue: 500, orderCount: 1 }],
      '2026-10-01',
      '2026-10-03',
      'day',
    );
    expect(out).toEqual([
      { key: '2026-10-01', revenue: 0, orderCount: 0 },
      { key: '2026-10-02', revenue: 500, orderCount: 1 },
      { key: '2026-10-03', revenue: 0, orderCount: 0 },
    ]);
  });

  it('khoảng một ngày chỉ ra một phần tử', () => {
    expect(fillBuckets([], '2026-10-05', '2026-10-05', 'day')).toHaveLength(1);
  });

  it('qua tháng 2 năm nhuận không lệch ngày', () => {
    expect(listBucketKeys('2028-02-27', '2028-03-01', 'day')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('theo tháng, qua giao thừa', () => {
    expect(listBucketKeys('2025-11-15', '2026-02-02', 'month')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('bỏ qua dòng ngoài khoảng', () => {
    const out = fillBuckets(
      [{ key: '2026-09-30', revenue: 9, orderCount: 1 }],
      '2026-10-01',
      '2026-10-01',
      'day',
    );
    expect(out).toEqual([{ key: '2026-10-01', revenue: 0, orderCount: 0 }]);
  });
});

describe('ánh xạ BigInt', () => {
  it('bigint 4 tỷ thành number', () => {
    const n = toNumber(BigInt(4_000_000_000));
    expect(n).toBe(4_000_000_000);
    expect(typeof n).toBe('number');
  });

  it('null thành 0; vượt phạm vi an toàn thì ném', () => {
    expect(toNumber(null)).toBe(0);
    expect(() => toNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).toThrow(
      RangeError,
    );
  });

  it('dòng sau ánh xạ đi qua JSON.stringify không ném', () => {
    const row = numberifyRow({
      key: '2026-10-01',
      revenue: BigInt(4_000_000_000),
      orderCount: BigInt(3),
    });
    expect(JSON.parse(JSON.stringify(row))).toEqual({
      key: '2026-10-01',
      revenue: 4_000_000_000,
      orderCount: 3,
    });
  });

  it('đối chứng: bigint thô làm JSON.stringify ném', () => {
    expect(() => JSON.stringify({ x: BigInt(1) })).toThrow(TypeError);
  });
});
