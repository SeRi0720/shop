import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException, Logger } from '@nestjs/common';
import { OrderService } from './order.service';

const VIEW = { id: 5, totalAmount: 12_500_000 } as never;
const CREATED_AT = new Date('2026-11-02T08:15:29.870Z');
const COMMITTED = {
  orderId: 5,
  vnpayPayment: null,
  totalAmount: 12_500_000,
  itemCount: 2,
  createdAt: CREATED_AT,
};
const DTO = {
  paymentMethod: 'COD',
  shippingName: 'A',
  shippingPhone: '0900000000',
  shippingAddress: 'x',
} as never;

function setup(
  opts: {
    publish?: (...args: unknown[]) => Promise<void>;
    transaction?: () => Promise<unknown>;
  } = {},
) {
  const calls: string[] = [];
  const prisma = {
    $transaction: jest.fn(async () => {
      const result = opts.transaction ? await opts.transaction() : COMMITTED;
      calls.push('commit');
      return result;
    }),
  };
  const events = {
    publish: jest.fn((...args: unknown[]) => {
      calls.push('publish');
      return opts.publish ? opts.publish(...args) : Promise.resolve();
    }),
  };
  const service = new OrderService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    { isConfigured: () => true } as never,
    events as never,
  );
  jest.spyOn(service, 'findOneForUser').mockResolvedValue(VIEW);
  return { service, events, calls };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('OrderService.create publish order.created', () => {
  it('publish đúng một lần, SAU commit, đúng topic, khóa và data', async () => {
    const { service, events, calls } = setup();
    await service.create(7, DTO);
    expect(calls).toEqual(['commit', 'publish']);
    expect(events.publish).toHaveBeenCalledTimes(1);
    const [topic, envelope, key] = events.publish.mock.calls[0] as [
      string,
      { type: string; version: number; data: unknown },
      string,
    ];
    expect(topic).toBe('order.created');
    expect(key).toBe('5');
    expect(envelope.type).toBe('order.created');
    expect(envelope.version).toBe(1);
    expect(envelope.data).toEqual({
      orderId: 5,
      userId: 7,
      totalAmount: 12_500_000,
      paymentMethod: 'COD',
      itemCount: 2,
      createdAt: CREATED_AT.toISOString(),
    });
  });

  it('publish bị reject thì đơn vẫn trả về và có ghi log lỗi', async () => {
    const spy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service } = setup({
      publish: () => Promise.reject(new Error('kafka down')),
    });
    await expect(service.create(7, DTO)).resolves.toBe(VIEW);
    await flush();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('đơn 5'));
    spy.mockRestore();
  });

  it('publish ném lỗi đồng bộ cũng không làm hỏng đơn', async () => {
    const spy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service } = setup({
      publish: () => {
        throw new Error('sync boom');
      },
    });
    await expect(service.create(7, DTO)).resolves.toBe(VIEW);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('dựng dữ liệu sự kiện lỗi (thiếu createdAt) cũng không làm hỏng đơn đã commit', async () => {
    const spy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service, events } = setup({
      transaction: () =>
        Promise.resolve({ ...COMMITTED, createdAt: undefined }),
    });
    await expect(service.create(7, DTO)).resolves.toBe(VIEW);
    expect(events.publish).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('đơn 5'));
    spy.mockRestore();
  });

  it('publish treo mãi thì create vẫn trả về bình thường', async () => {
    const { service } = setup({
      publish: () => new Promise<void>(() => undefined),
    });
    await expect(service.create(7, DTO)).resolves.toBe(VIEW);
  });

  it('transaction lỗi (hết hàng, giỏ rỗng) thì KHÔNG publish', async () => {
    const { service, events } = setup({
      transaction: () => Promise.reject(new ConflictException('hết hàng')),
    });
    await expect(service.create(7, DTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(events.publish).not.toHaveBeenCalled();
  });
});
