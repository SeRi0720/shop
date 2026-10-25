// DUY NHẤT file import thư viện client Kafka (quyết định 3). Đổi client chỉ sửa file này.
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { KafkaConfig } from './kafka.config';

export type KafkaProducer = KafkaJS.Producer;
export type KafkaConsumer = KafkaJS.Consumer;
export type KafkaAdmin = KafkaJS.Admin;

export interface LogSink {
  warn(message: string): void;
  error(message: string): void;
}

export interface KafkaClient {
  producer(): KafkaProducer;
  consumer(groupId: string): KafkaConsumer;
  admin(): KafkaAdmin;
}

const fmt = (message: string, extra?: object) =>
  extra ? `${message} ${JSON.stringify(extra)}` : message;

// Khi broker tắt, thư viện ghi "Connection refused" vài lần mỗi giây. Chỉ cho qua một dòng
// mỗi 30 giây cho mỗi thông điệp giống nhau (bỏ số để "after 0ms" và cổng không làm khác khóa).
const THROTTLE_MS = 30_000;
const lastLogged = new Map<string, number>();
function shouldLog(message: string): boolean {
  const key = message.replace(/\d+/g, '#').slice(0, 200);
  const now = Date.now();
  const last = lastLogged.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return false;
  if (lastLogged.size > 200) lastLogged.clear();
  lastLogged.set(key, now);
  return true;
}

/** Đưa log của thư viện về logger của ứng dụng, chỉ từ mức cảnh báo (quyết định 13). */
function makeLogger(sink: LogSink): KafkaJS.Logger {
  const logger: KafkaJS.Logger = {
    info: () => undefined,
    debug: () => undefined,
    warn: (message, extra) => {
      const text = fmt(message, extra);
      if (shouldLog(text)) sink.warn(text);
    },
    error: (message, extra) => {
      const text = fmt(message, extra);
      if (shouldLog(text)) sink.error(text);
    },
    namespace: () => logger,
    setLogLevel: () => undefined,
  };
  return logger;
}

export function createKafkaClient(cfg: KafkaConfig, sink: LogSink): KafkaClient {
  const kafka = new KafkaJS.Kafka({
    kafkaJS: {
      clientId: cfg.clientId,
      brokers: cfg.brokers,
      logLevel: KafkaJS.logLevel.WARN,
      logger: makeLogger(sink),
    },
  });
  return {
    // Idempotent + acks=-1 (all). Broker đã tắt auto-create topic nên cũng tắt phía producer.
    producer: () =>
      kafka.producer({
        kafkaJS: { idempotent: true, acks: -1, allowAutoTopicCreation: false },
      }),
    // fromBeginning: group mới đọc từ đầu, kết hợp chống trùng nên phát lại là an toàn.
    consumer: (groupId) =>
      kafka.consumer({
        kafkaJS: { groupId, fromBeginning: true, autoCommit: true },
      }),
    admin: () => kafka.admin(),
  };
}

/** Chuẩn hóa message nhận về thành kiểu thuần, không lộ kiểu của thư viện ra ngoài file này. */
export interface IncomingMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
}

export function toIncoming(
  topic: string,
  partition: number,
  message: KafkaJS.Message & { offset: string },
): IncomingMessage {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(message.headers ?? {})) {
    if (v === undefined) continue;
    headers[k] = Array.isArray(v) ? v.map(String).join(',') : String(v);
  }
  return {
    topic,
    partition,
    offset: message.offset,
    key: message.key == null ? null : String(message.key),
    value: message.value == null ? null : String(message.value),
    headers,
  };
}
