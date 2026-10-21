import { BadRequestException } from '@nestjs/common';
import { vnDayEnd, vnDayStart } from '../common/vn-date';

export type Granularity = 'day' | 'month';

export interface ResolvedRange {
  fromDay: string; // yyyy-MM-dd, giờ VN
  toDay: string;
  from: Date; // mốc UTC: 00:00:00.000 giờ VN của fromDay
  to: Date; // mốc UTC: 23:59:59.999 giờ VN của toDay
  granularity: Granularity;
}

export const MAX_DAYS = 366;
export const MAX_MONTHS = 24;
const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

export function todayVn(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function resolveRange(
  input: { from?: string; to?: string; granularity?: Granularity },
  now: Date = new Date(),
): ResolvedRange {
  const granularity = input.granularity ?? 'day';
  const toDay = input.to ?? todayVn(now);
  if (vnDayStart(toDay) === null)
    throw new BadRequestException('Ngày không hợp lệ');
  const fromDay = input.from ?? addDays(toDay, -29); // mặc định 30 ngày gồm cả hôm nay
  const from = vnDayStart(fromDay);
  const to = vnDayEnd(toDay);
  if (from === null || to === null)
    throw new BadRequestException('Ngày không hợp lệ');
  if (from > to) throw new BadRequestException('from không được sau to');

  const [fy, fm] = fromDay.split('-').map(Number);
  const [ty, tm] = toDay.split('-').map(Number);
  if (granularity === 'day') {
    const days =
      Math.round(
        (Date.UTC(ty, tm - 1, Number(toDay.slice(8))) -
          Date.UTC(fy, fm - 1, Number(fromDay.slice(8)))) /
          DAY_MS,
      ) + 1;
    if (days > MAX_DAYS)
      throw new BadRequestException(`Tối đa ${MAX_DAYS} ngày`);
  } else {
    const months = ty * 12 + tm - (fy * 12 + fm) + 1;
    if (months > MAX_MONTHS)
      throw new BadRequestException(`Tối đa ${MAX_MONTHS} tháng`);
  }
  return { fromDay, toDay, from, to, granularity };
}
