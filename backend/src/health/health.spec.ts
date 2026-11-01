import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DB_TIMEOUT_MS, HealthService } from './health.service';

interface Parts {
  db?: () => unknown;
  redis?: Partial<{ cfg: { enabled: boolean }; isReady: boolean }>;
  kafka?: Partial<{ cfg: { enabled: boolean }; isReady: boolean }>;
}

const build = (o: Parts = {}) => {
  const prisma = {
    $queryRaw: jest.fn(o.db ?? (() => Promise.resolve([{ ok: 1 }]))),
  };
  const redis = { cfg: { enabled: true }, isReady: true, ...o.redis };
  const kafka = { cfg: { enabled: true }, isReady: true, ...o.kafka };
  return new HealthService(prisma as never, redis as never, kafka as never);
};

describe('HealthService', () => {
  afterEach(() => jest.useRealTimers());

  it('DB ổn: healthy, status ok', async () => {
    const r = await build().check();
    expect(r.healthy).toBe(true);
    expect(r.body).toMatchObject({
      status: 'ok',
      db: 'ok',
      redis: 'ok',
      kafka: 'ok',
    });
  });

  it('DB reject: không healthy, status down', async () => {
    const r = await build({ db: () => Promise.reject(new Error('x')) }).check();
    expect(r.healthy).toBe(false);
    expect(r.body).toMatchObject({ status: 'down', db: 'down' });
  });

  it('DB treo quá 2 giây: không healthy', async () => {
    jest.useFakeTimers();
    const p = build({ db: () => new Promise(() => undefined) }).check();
    await jest.advanceTimersByTimeAsync(DB_TIMEOUT_MS);
    expect((await p).healthy).toBe(false);
  });

  it('Redis chưa sẵn sàng: vẫn healthy, redis down, status degraded', async () => {
    const r = await build({ redis: { isReady: false } }).check();
    expect(r.healthy).toBe(true);
    expect(r.body).toMatchObject({ status: 'degraded', redis: 'down' });
  });

  it('Kafka chưa nối: vẫn healthy, kafka down, status degraded', async () => {
    const r = await build({ kafka: { isReady: false } }).check();
    expect(r.healthy).toBe(true);
    expect(r.body).toMatchObject({ status: 'degraded', kafka: 'down' });
  });

  it('tắt bằng cờ: báo disabled, không tính là lỗi', async () => {
    const r = await build({
      redis: { cfg: { enabled: false }, isReady: false },
      kafka: { cfg: { enabled: false }, isReady: false },
    }).check();
    expect(r.body).toMatchObject({
      status: 'ok',
      redis: 'disabled',
      kafka: 'disabled',
    });
  });

  it('thân phản hồi chỉ có đúng 5 trường (không địa chỉ, không phiên bản)', async () => {
    const { body } = await build().check();
    expect(Object.keys(body).sort()).toEqual([
      'db',
      'kafka',
      'redis',
      'status',
      'uptimeSeconds',
    ]);
  });
});

describe('HealthController', () => {
  it('healthy: trả thân JSON (HTTP 200)', async () => {
    const body = { status: 'ok' };
    const ctrl = new HealthController({
      check: () => Promise.resolve({ healthy: true, body }),
    } as never);
    await expect(ctrl.check()).resolves.toBe(body);
  });

  it('không healthy: ném 503 kèm thân JSON', async () => {
    const body = { status: 'down' };
    const ctrl = new HealthController({
      check: () => Promise.resolve({ healthy: false, body }),
    } as never);
    const err: unknown = await ctrl.check().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getStatus()).toBe(503);
    expect((err as ServiceUnavailableException).getResponse()).toEqual(body);
  });
});
