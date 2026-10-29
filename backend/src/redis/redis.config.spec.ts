import { readRedisConfig } from './redis.config';

describe('readRedisConfig', () => {
  it('env rỗng: dùng giá trị mặc định', () => {
    expect(readRedisConfig({})).toEqual({
      enabled: true,
      url: 'redis://127.0.0.1:6379',
      cacheEnabled: true,
      databasePoolMax: 5,
    });
  });

  it('đọc đúng REDIS_URL và cắt khoảng trắng; chuỗi rỗng về mặc định', () => {
    expect(readRedisConfig({ REDIS_URL: ' redis://redis:6379 ' }).url).toBe(
      'redis://redis:6379',
    );
    expect(readRedisConfig({ REDIS_URL: '   ' }).url).toBe(
      'redis://127.0.0.1:6379',
    );
  });

  it.each(['false', 'FALSE', '0', 'no', 'off', ' false '])(
    'REDIS_ENABLED=%j đọc ra false',
    (v) => {
      expect(readRedisConfig({ REDIS_ENABLED: v }).enabled).toBe(false);
    },
  );

  it.each(['false', '0', 'off'])('CACHE_ENABLED=%j đọc ra false', (v) => {
    expect(readRedisConfig({ CACHE_ENABLED: v }).cacheEnabled).toBe(false);
  });

  it('REDIS_ENABLED và CACHE_ENABLED độc lập nhau', () => {
    const cfg = readRedisConfig({ REDIS_ENABLED: 'false' });
    expect(cfg.enabled).toBe(false);
    expect(cfg.cacheEnabled).toBe(true);
  });

  it.each(['true', '1', 'yes', 'abc', ''])(
    'REDIS_ENABLED=%j không phải giá trị tắt nên vẫn bật',
    (v) => {
      expect(readRedisConfig({ REDIS_ENABLED: v }).enabled).toBe(true);
    },
  );

  it('DATABASE_POOL_MAX hợp lệ được giữ nguyên', () => {
    expect(readRedisConfig({ DATABASE_POOL_MAX: '10' }).databasePoolMax).toBe(
      10,
    );
  });

  it.each(['abc', '0', '-1', '2.5', ''])(
    'DATABASE_POOL_MAX=%j không hợp lệ thì về mặc định 5',
    (v) => {
      expect(readRedisConfig({ DATABASE_POOL_MAX: v }).databasePoolMax).toBe(5);
    },
  );
});
