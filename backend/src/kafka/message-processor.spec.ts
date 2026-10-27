import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvalidEventError } from './events';
import type { IncomingMessage } from './kafka.client';
import { MessageProcessor, type Processable } from './message-processor';

const MSG: IncomingMessage = {
  topic: 'order.created',
  partition: 2,
  offset: '41',
  key: '5',
  value: '{"x":1}',
  headers: { 'event-id': 'e1' },
};
const NOW = new Date('2026-11-02T10:00:00.000Z');

function setup(opts: { stopping?: () => boolean } = {}) {
  const sleeps: number[] = [];
  const publishDlt = jest.fn(
    async (
      _t: string,
      _k: string | null,
      _v: string | null,
      _h: Record<string, string>,
    ) => undefined,
  );
  const logger = { warn: jest.fn(), error: jest.fn() };
  const processor = new MessageProcessor({
    baseDelayMs: 1000,
    maxRetries: 3,
    dltFailureDelayMs: 777,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    isStopping: opts.stopping ?? (() => false),
    publishDlt,
    now: () => NOW,
    logger,
  });
  const def = (handle: Processable['handle']): Processable => ({
    groupId: 'g',
    dltTopic: 'order.created.dlt',
    handle,
  });
  return { processor, publishDlt, logger, sleeps, def };
}

describe('MessageProcessor', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('thành công ngay: gọi 1 lần, không retry, không dead-letter', async () => {
    const handle = jest.fn(async () => undefined);
    await ctx.processor.process(ctx.def(handle), MSG);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(ctx.sleeps).toEqual([]);
    expect(ctx.publishDlt).not.toHaveBeenCalled();
  });

  it('lỗi 2 lần rồi thành công: gọi 3 lần, không dead-letter, resolve (commit)', async () => {
    const handle = jest
      .fn<Processable['handle']>()
      .mockRejectedValueOnce(new Error('db'))
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValue(undefined);
    await expect(
      ctx.processor.process(ctx.def(handle), MSG),
    ).resolves.toBeUndefined();
    expect(handle).toHaveBeenCalledTimes(3);
    expect(ctx.publishDlt).not.toHaveBeenCalled();
  });

  it('chờ tăng dần gấp đôi từ giá trị gốc: 1s, 2s, 4s', async () => {
    const handle = jest.fn(async () => {
      throw new Error('db');
    });
    await ctx.processor.process(ctx.def(handle), MSG);
    expect(ctx.sleeps).toEqual([1000, 2000, 4000]);
  });

  it('lỗi mãi: gọi 1 + 3 lần, dead-letter đúng một lần với đủ header', async () => {
    const handle = jest.fn(async () => {
      throw new Error('db sập');
    });
    await ctx.processor.process(ctx.def(handle), MSG);
    expect(handle).toHaveBeenCalledTimes(4);
    expect(ctx.publishDlt).toHaveBeenCalledTimes(1);
    const [topic, key, value, headers] = ctx.publishDlt.mock.calls[0];
    expect(topic).toBe('order.created.dlt');
    expect(key).toBe('5');
    expect(value).toBe('{"x":1}');
    expect(headers).toEqual({
      'event-id': 'e1', // giữ header gốc
      'x-original-topic': 'order.created',
      'x-original-partition': '2',
      'x-original-offset': '41',
      'x-error': 'db sập',
      'x-attempts': '4',
      'x-failed-at': NOW.toISOString(),
    });
  });

  it('InvalidEventError: gọi 1 lần, vào dead-letter ngay, không chờ', async () => {
    const handle = jest.fn(async () => {
      throw new InvalidEventError('JSON hỏng');
    });
    await ctx.processor.process(ctx.def(handle), MSG);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(ctx.sleeps).toEqual([]);
    expect(ctx.publishDlt.mock.calls[0][3]['x-attempts']).toBe('1');
    expect(ctx.publishDlt.mock.calls[0][3]['x-error']).toBe('JSON hỏng');
  });

  it('gửi dead-letter lỗi: chờ rồi NÉM LỖI (không commit, message được giao lại)', async () => {
    ctx.publishDlt.mockRejectedValueOnce(new Error('kafka down'));
    const handle = jest.fn(async () => {
      throw new InvalidEventError('x');
    });
    await expect(ctx.processor.process(ctx.def(handle), MSG)).rejects.toThrow(
      'kafka down',
    );
    expect(ctx.sleeps).toEqual([777]);
  });

  it('x-error bị cắt còn 500 ký tự', async () => {
    const handle = jest.fn(async () => {
      throw new InvalidEventError('a'.repeat(2000));
    });
    await ctx.processor.process(ctx.def(handle), MSG);
    expect(ctx.publishDlt.mock.calls[0][3]['x-error']).toHaveLength(500);
  });

  it('ứng dụng đang tắt giữa lúc chờ retry: ném lỗi, không dead-letter', async () => {
    const stopped = setup({ stopping: () => true });
    const handle = jest.fn(async () => {
      throw new Error('db');
    });
    await expect(
      stopped.processor.process(stopped.def(handle), MSG),
    ).rejects.toThrow(/đang tắt/);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(stopped.publishDlt).not.toHaveBeenCalled();
  });
});
