import { describe, expect, it } from '@jest/globals';
import {
  InvalidEventError,
  ORDER_CREATED,
  buildEnvelope,
  envelopeHeaders,
  parseOrderCreated,
} from './events';

const valid = {
  orderId: 5,
  userId: 7,
  totalAmount: 12_500_000,
  paymentMethod: 'COD',
  itemCount: 2,
  createdAt: '2026-11-02T08:15:29.870Z',
};
// Giá trị undefined bị JSON.stringify bỏ, dùng để "xóa" một trường.
const raw = (
  data: Record<string, unknown> = {},
  env: Record<string, unknown> = {},
) =>
  JSON.stringify({
    ...buildEnvelope(ORDER_CREATED, { ...valid, ...data }),
    ...env,
  });

describe('buildEnvelope', () => {
  it('eventId là UUID v4, khác nhau giữa hai lần dựng', () => {
    const a = buildEnvelope('t', {});
    const b = buildEnvelope('t', {});
    expect(a.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a.eventId).not.toBe(b.eventId);
  });

  it('có type, version 1, occurredAt ISO 8601 UTC', () => {
    const now = new Date('2026-11-02T08:15:29.870Z');
    const e = buildEnvelope('order.created', {}, { now });
    expect(e.type).toBe('order.created');
    expect(e.version).toBe(1);
    expect(e.occurredAt).toBe('2026-11-02T08:15:29.870Z');
  });

  it('nhận eventId do người gọi chỉ định', () => {
    expect(buildEnvelope('t', {}, { eventId: 'abc' }).eventId).toBe('abc');
  });

  it('header gồm đúng 4 khóa của Phụ lục B', () => {
    const keys = Object.keys(envelopeHeaders(buildEnvelope('t', {}))).sort();
    expect(keys).toEqual([
      'event-id',
      'event-type',
      'event-version',
      'produced-at',
    ]);
  });
});

describe('parseOrderCreated', () => {
  it('chấp nhận sự kiện hợp lệ', () => {
    expect(parseOrderCreated(raw()).data).toMatchObject(valid);
  });

  it('loại bỏ trường lạ: không lọt thông tin cá nhân vào data', () => {
    const e = parseOrderCreated(
      raw({ shippingName: 'A', shippingPhone: '09', shippingAddress: 'x' }),
    );
    expect(Object.keys(e.data).sort()).toEqual([
      'createdAt',
      'itemCount',
      'orderId',
      'paymentMethod',
      'totalAmount',
      'userId',
    ]);
  });

  it.each([
    ['thiếu orderId', raw({ orderId: undefined })],
    ['orderId không nguyên', raw({ orderId: 1.5 })],
    ['orderId là chuỗi', raw({ orderId: '5' })],
    ['totalAmount âm', raw({ totalAmount: -1 })],
    ['paymentMethod lạ', raw({ paymentMethod: 'PAYPAL' })],
    ['itemCount bằng 0', raw({ itemCount: 0 })],
    ['createdAt không phải ISO', raw({ createdAt: 'hôm qua' })],
    ['version khác 1', raw({}, { version: 2 })],
    ['type sai', raw({}, { type: 'order.cancelled' })],
    ['thiếu eventId', raw({}, { eventId: undefined })],
    ['thiếu data', raw({}, { data: undefined })],
    ['JSON hỏng', 'không phải json {'],
    ['không phải object', '42'],
    ['message rỗng (null)', null],
  ])('từ chối: %s', (_name, input) => {
    expect(() => parseOrderCreated(input)).toThrow(InvalidEventError);
  });
});
