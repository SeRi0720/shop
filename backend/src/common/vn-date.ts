const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const VN_OFFSET_H = 7;

/** 00:00:00.000 của ngày yyyy-MM-dd theo giờ VN (trả về mốc UTC). Sai định dạng hoặc ngày không có thật: null. */
export function vnDayStart(day: string): Date | null {
  const m = DAY.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = new Date(Date.UTC(y, mo - 1, d, -VN_OFFSET_H));
  // Chặn tràn ngày (2026-02-31 sẽ tự nhảy sang tháng 3)
  const back = new Date(start.getTime() + VN_OFFSET_H * 3_600_000);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d
  ) {
    return null;
  }
  return start;
}

/** 23:59:59.999 của ngày đó theo giờ VN. */
export function vnDayEnd(day: string): Date | null {
  const start = vnDayStart(day);
  return start ? new Date(start.getTime() + 86_400_000 - 1) : null;
}
