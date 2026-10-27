import { describe, expect, it, jest } from '@jest/globals';
import {
  InvalidEventError,
  ORDER_CREATED,
  buildEnvelope,
} from '../kafka/events';
import type { IncomingMessage } from '../kafka/kafka.client';
import { TOPICS } from '../kafka/kafka.constants';
import {
  KIND_ADMIN_NEW_ORDER,
  NOTIFICATION,
  deriveAdminNewOrderEventId,
  type NotificationData,
} from './notification.events';
import {
  BUILDER_GROUP,
  NotificationService,
  SENDER_GROUP,
} from './notification.service';

// NotificationService kéo KafkaService -> kafka.client -> thư viện native (librdkafka).
// Spec này không cần broker nên không nạp bản native.
jest.mock('../kafka/kafka.client', () => ({}));

const orderData = {
  orderId: 5,
  userId: 7,
  totalAmount: 12_500_000,
  paymentMethod: 'VNPAY',
  itemCount: 2,
  createdAt: '2026-11-02T08:15:29.870Z',
};
const source = buildEnvelope(ORDER_CREATED, orderData);
const msg = (topic: string, value: string | null): IncomingMessage => ({
  topic,
  partition: 0,
  offset: '1',
  key: '5',
  value,
  headers: {},
});

function setup() {
  const kafka = { registerConsumer: jest.fn() };
  // runOnce giả: chạy hiệu ứng, lỗi thì ném tiếp (giống bản thật).
  const idempotency = {
    runOnce: jest.fn(
      async (_c: string, _id: string, fx: () => Promise<void>) => {
        await fx();
        return 'processed';
      },
    ),
  };
  const bus = { publish: jest.fn(async (..._a: unknown[]) => undefined) };
  const calls: string[] = [];
  const mkChannel = (name: string) => ({
    name,
    send: jest.fn(async (_e: unknown) => {
      calls.push(name);
    }),
  });
  const socket = mkChannel('socket');
  const log = mkChannel('log');
  const service = new NotificationService(
    kafka as never,
    idempotency as never,
    bus as never,
    [socket, log] as never,
  );
  return { service, kafka, idempotency, bus, socket, log, calls };
}

describe('deriveAdminNewOrderEventId', () => {
  it('có tính xác định', () => {
    expect(deriveAdminNewOrderEventId('abc')).toBe('abc:admin-new-order');
    expect(deriveAdminNewOrderEventId('abc')).toBe(
      deriveAdminNewOrderEventId('abc'),
    );
  });
});

describe('NotificationService nấc 1 (order.created -> notification)', () => {
  it('đăng ký hai consumer: đúng group, topic và dead-letter', () => {
    const { service, kafka } = setup();
    service.onModuleInit();
    const defs = kafka.registerConsumer.mock.calls.map((c) => c[0]);
    expect(defs).toEqual([
      expect.objectContaining({
        groupId: BUILDER_GROUP,
        topic: TOPICS.ORDER_CREATED,
        dltTopic: TOPICS.ORDER_CREATED_DLT,
      }),
      expect.objectContaining({
        groupId: SENDER_GROUP,
        topic: TOPICS.NOTIFICATION,
        dltTopic: TOPICS.NOTIFICATION_DLT,
      }),
    ]);
  });

  it('publish đúng một message notification: đúng khóa, eventId suy ra, tham chiếu eventId gốc', async () => {
    const { service, bus, idempotency } = setup();
    await service.buildFromOrderCreated(
      msg(TOPICS.ORDER_CREATED, JSON.stringify(source)),
    );
    expect(idempotency.runOnce).toHaveBeenCalledWith(
      BUILDER_GROUP,
      source.eventId,
      expect.any(Function),
    );
    expect(bus.publish).toHaveBeenCalledTimes(1);
    const [topic, env, key] = bus.publish.mock.calls[0] as [
      string,
      { eventId: string; type: string; data: NotificationData },
      string,
    ];
    expect(topic).toBe(TOPICS.NOTIFICATION);
    expect(key).toBe('5');
    expect(env.type).toBe(NOTIFICATION);
    expect(env.eventId).toBe(`${source.eventId}:admin-new-order`);
    expect(env.data).toEqual({
      kind: KIND_ADMIN_NEW_ORDER,
      causationId: source.eventId,
      orderId: 5,
      totalAmount: 12_500_000,
      paymentMethod: 'VNPAY',
    });
  });

  it('chạy hai lần cùng sự kiện gốc cho cùng eventId của notification', async () => {
    const { service, bus } = setup();
    const m = msg(TOPICS.ORDER_CREATED, JSON.stringify(source));
    await service.buildFromOrderCreated(m);
    await service.buildFromOrderCreated(m);
    const ids = bus.publish.mock.calls.map(
      (c) => (c[1] as { eventId: string }).eventId,
    );
    expect(ids[0]).toBe(ids[1]);
  });

  it('sai hợp đồng: ném InvalidEventError, không chống trùng, không publish', async () => {
    const { service, bus, idempotency } = setup();
    await expect(
      service.buildFromOrderCreated(msg(TOPICS.ORDER_CREATED, '{"x":1}')),
    ).rejects.toBeInstanceOf(InvalidEventError);
    expect(idempotency.runOnce).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('publish lỗi thì lỗi nổi lên (để consumer retry, không nuốt)', async () => {
    const { service, bus } = setup();
    bus.publish.mockRejectedValueOnce(new Error('kafka down'));
    await expect(
      service.buildFromOrderCreated(
        msg(TOPICS.ORDER_CREATED, JSON.stringify(source)),
      ),
    ).rejects.toThrow('kafka down');
  });
});

describe('NotificationService nấc 2 (notification -> kênh)', () => {
  const notification = buildEnvelope(
    NOTIFICATION,
    {
      kind: KIND_ADMIN_NEW_ORDER,
      causationId: 'src-1',
      orderId: 5,
      totalAmount: 12_500_000,
      paymentMethod: 'COD',
    },
    { eventId: 'src-1:admin-new-order' },
  );
  const m = msg(TOPICS.NOTIFICATION, JSON.stringify(notification));

  it('gọi mỗi kênh đúng một lần với đúng sự kiện, socket trước log', async () => {
    const { service, socket, log, calls, idempotency } = setup();
    await service.sendNotification(m);
    expect(idempotency.runOnce).toHaveBeenCalledWith(
      SENDER_GROUP,
      'src-1:admin-new-order',
      expect.any(Function),
    );
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(log.send).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['socket', 'log']);
    expect(
      (socket.send.mock.calls[0][0] as { data: NotificationData }).data,
    ).toMatchObject({ orderId: 5, totalAmount: 12_500_000 });
  });

  it('kênh socket lỗi: lỗi nổi lên và kênh log KHÔNG được gọi', async () => {
    const { service, socket, log } = setup();
    socket.send.mockRejectedValueOnce(new Error('socket chưa sẵn sàng'));
    await expect(service.sendNotification(m)).rejects.toThrow(
      'socket chưa sẵn sàng',
    );
    expect(log.send).not.toHaveBeenCalled();
  });

  it('message sai hợp đồng: InvalidEventError, không kênh nào được gọi', async () => {
    const { service, socket, log } = setup();
    await expect(
      service.sendNotification(msg(TOPICS.NOTIFICATION, '{"kind":"X"}')),
    ).rejects.toBeInstanceOf(InvalidEventError);
    expect(socket.send).not.toHaveBeenCalled();
    expect(log.send).not.toHaveBeenCalled();
  });
});
