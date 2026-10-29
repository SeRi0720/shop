export interface RedisConfig {
  enabled: boolean;
  url: string;
  cacheEnabled: boolean;
  databasePoolMax: number;
}

type Env = Record<string, string | undefined>;

const bool = (v: string | undefined, fallback: boolean): boolean => {
  if (v === undefined || v.trim() === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(v.trim().toLowerCase());
};

const positiveInt = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export function readRedisConfig(env: Env): RedisConfig {
  return {
    enabled: bool(env.REDIS_ENABLED, true),
    url: env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379', // không dùng localhost (bài học ::1 tuần 9)
    cacheEnabled: bool(env.CACHE_ENABLED, true),
    databasePoolMax: positiveInt(env.DATABASE_POOL_MAX, 5),
  };
}
