import { addDays, type Granularity } from './stats-range';

export interface RevenueBucket {
  key: string; // yyyy-MM-dd hoặc yyyy-MM
  revenue: number;
  orderCount: number;
}

export function listBucketKeys(
  fromDay: string,
  toDay: string,
  g: Granularity,
): string[] {
  const keys: string[] = [];
  if (g === 'day') {
    for (let d = fromDay; d <= toDay; d = addDays(d, 1)) keys.push(d); // so sánh chuỗi ISO đúng thứ tự
    return keys;
  }
  let [y, m] = fromDay.split('-').map(Number);
  const [ty, tm] = toDay.split('-').map(Number);
  while (y * 12 + m <= ty * 12 + tm) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

/** SQL không trả dòng cho ngày/tháng không có đơn; điền 0 để biểu đồ liền mạch. */
export function fillBuckets(
  rows: RevenueBucket[],
  fromDay: string,
  toDay: string,
  g: Granularity,
): RevenueBucket[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return listBucketKeys(fromDay, toDay, g).map(
    (key) => byKey.get(key) ?? { key, revenue: 0, orderCount: 0 },
  );
}
