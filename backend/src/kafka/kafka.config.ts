export interface KafkaConfig {
  enabled: boolean;
  brokers: string[];
  clientId: string;
  consumersEnabled: boolean;
  retryBaseMs: number;
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

/** Hàm thuần (nhận env, không đụng process.env) để test và để script dùng lại. */
export function readKafkaConfig(env: Env): KafkaConfig {
  const brokers = (env.KAFKA_BROKERS ?? '127.0.0.1:9092')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    enabled: bool(env.KAFKA_ENABLED, true),
    brokers: brokers.length > 0 ? brokers : ['127.0.0.1:9092'],
    clientId: env.KAFKA_CLIENT_ID?.trim() || 'shop-backend',
    consumersEnabled: bool(env.KAFKA_CONSUMERS_ENABLED, true),
    retryBaseMs: positiveInt(env.KAFKA_RETRY_BASE_MS, 1000),
  };
}
