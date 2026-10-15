import { vnDayEnd, vnDayStart } from './vn-date';

describe('vn-date', () => {
  it('vnDayStart / vnDayEnd theo +07:00', () => {
    expect(vnDayStart('2026-10-14')?.toISOString()).toBe(
      '2026-10-13T17:00:00.000Z',
    );
    expect(vnDayEnd('2026-10-14')?.toISOString()).toBe(
      '2026-10-14T16:59:59.999Z',
    );
  });

  it('đơn lúc 00:30 và 23:30 giờ VN nằm trong ngày 14; 00:00 ngày 15 thì không', () => {
    const s = vnDayStart('2026-10-14')!.getTime();
    const e = vnDayEnd('2026-10-14')!.getTime();
    const inDay = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= s && t <= e;
    };
    expect(inDay('2026-10-13T17:30:00Z')).toBe(true); // 00:30 ngày 14
    expect(inDay('2026-10-14T16:30:00Z')).toBe(true); // 23:30 ngày 14
    expect(inDay('2026-10-14T17:00:00Z')).toBe(false); // 00:00 ngày 15
  });

  it.each(['2026-02-31', '2026-13-01', '2026-10-32', 'abc', '2026-1-1', ''])(
    'ngày không hợp lệ %j trả null',
    (v) => {
      expect(vnDayStart(v)).toBeNull();
      expect(vnDayEnd(v)).toBeNull();
    },
  );

  it('năm nhuận: 2028-02-29 hợp lệ, 2026-02-29 thì không', () => {
    expect(vnDayStart('2028-02-29')).not.toBeNull();
    expect(vnDayStart('2026-02-29')).toBeNull();
  });
});
