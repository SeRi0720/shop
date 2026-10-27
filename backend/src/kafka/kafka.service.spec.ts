import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Logger } from '@nestjs/common';
import { buildEnvelope } from './events';
import { createKafkaClient } from './kafka.client';
import { KafkaService } from './kafka.service';

// Không nạp thư viện native và không cần broker: client là bản giả.
jest.mock('./kafka.client', () => ({
  createKafkaClient: jest.fn(),
  toIncoming: jest.fn(),
}));

const mockedCreate = createKafkaClient as unknown as jest.Mock;

function fakeClient() {
  const producer = {
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    send: jest.fn(async (_m: unknown) => undefined),
  };
  const consumer = {
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    subscribe: jest.fn(async (_a: unknown) => undefined),
    run: jest.fn(async (_a: unknown) => undefined),
  };
  const admin = {
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    createTopics: jest.fn(async (_a: unknown) => true),
  };
  const client = {
    producer: () => producer,
    consumer: jest.fn((_groupId: string) => consumer),
    admin: () => admin,
  };
  return { client, producer, consumer, admin };
}

const make = (env: Record<string, string>) =>
  new KafkaService({ get: (k: string) => env[k] } as never);

const waitFor = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) {
    await new Promise((r) => setImmediate(r));
  }
  if (!cond()) throw new Error('hết thời gian chờ điều kiện');
};

const envelope = buildEnvelope('t', { a: 1 });

describe('KafkaService vòng đời (không cần broker)', () => {
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => {
    mockedCreate.mockReset();
  });

  it('KAFKA_ENABLED=false: không mở kết nối nào, publish là no-op', async () => {
    const svc = make({ KAFKA_ENABLED: 'false' });
    svc.onApplicationBootstrap();
    await expect(svc.publish('t', envelope, 'k')).resolves.toBeUndefined();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('publish khi producer chưa sẵn sàng thì ném lỗi (OrderService sẽ bắt và ghi log)', async () => {
    const svc = make({});
    await expect(svc.publish('t', envelope, 'k')).rejects.toThrow(
      /chưa sẵn sàng/,
    );
  });

  it('KAFKA_CONSUMERS_ENABLED=false: producer chạy, consumer không được tạo', async () => {
    const f = fakeClient();
    mockedCreate.mockReturnValue(f.client);
    const svc = make({ KAFKA_CONSUMERS_ENABLED: 'false' });
    svc.registerConsumer({
      groupId: 'g',
      topic: 't',
      dltTopic: 't.dlt',
      handle: async () => undefined,
    });
    svc.onApplicationBootstrap();
    await waitFor(() => f.admin.createTopics.mock.calls.length > 0);
    await svc.publish('t', envelope, 'k');
    expect(f.producer.send).toHaveBeenCalledTimes(1);
    expect(f.client.consumer).not.toHaveBeenCalled();
    await svc.onApplicationShutdown('SIGINT');
  });

  it('bật consumer: subscribe đúng topic; tắt thì ngắt cả consumer và producer', async () => {
    const f = fakeClient();
    mockedCreate.mockReturnValue(f.client);
    const svc = make({});
    svc.registerConsumer({
      groupId: 'g',
      topic: 'order.created',
      dltTopic: 'order.created.dlt',
      handle: async () => undefined,
    });
    svc.onApplicationBootstrap();
    await waitFor(() => f.consumer.run.mock.calls.length > 0);
    expect(f.client.consumer).toHaveBeenCalledWith('g');
    expect(f.consumer.subscribe).toHaveBeenCalledWith({
      topics: ['order.created'],
    });

    await svc.onApplicationShutdown('SIGINT');
    expect(f.consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(f.producer.disconnect).toHaveBeenCalledTimes(1);
    await expect(svc.publish('t', envelope, 'k')).rejects.toThrow(
      /chưa sẵn sàng/,
    );
  });

  it('tắt khi Kafka lỗi hoặc chưa từng kết nối: không ném lỗi', async () => {
    await expect(
      make({}).onApplicationShutdown('SIGTERM'),
    ).resolves.toBeUndefined();

    const f = fakeClient();
    f.consumer.disconnect.mockRejectedValue(new Error('mất kết nối'));
    f.producer.disconnect.mockRejectedValue(new Error('mất kết nối'));
    mockedCreate.mockReturnValue(f.client);
    const svc = make({});
    svc.registerConsumer({
      groupId: 'g',
      topic: 't',
      dltTopic: 't.dlt',
      handle: async () => undefined,
    });
    svc.onApplicationBootstrap();
    await waitFor(() => f.consumer.run.mock.calls.length > 0);
    await expect(svc.onApplicationShutdown('SIGINT')).resolves.toBeUndefined();
  });
});
