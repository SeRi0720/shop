import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EventBus } from './event-bus';
import { envelopeHeaders, type EventEnvelope } from './events';
import {
  createKafkaClient,
  toIncoming,
  type IncomingMessage,
  type KafkaClient,
  type KafkaConsumer,
  type KafkaProducer,
} from './kafka.client';
import { readKafkaConfig, type KafkaConfig } from './kafka.config';
import { TOPIC_SPECS } from './kafka.constants';

export interface ConsumerDefinition {
  groupId: string;
  topic: string;
  handle(message: IncomingMessage): Promise<void>;
}

const MAX_BACKOFF_MS = 30_000;

@Injectable()
export class KafkaService
  implements EventBus, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KafkaService.name);
  readonly cfg: KafkaConfig;

  private client?: KafkaClient;
  private producer?: KafkaProducer;
  private topicsReady = false;
  private producerReady = false;
  private stopping = false;
  private wake?: () => void;

  private readonly definitions: ConsumerDefinition[] = [];
  private readonly started = new Set<ConsumerDefinition>();
  private readonly consumers: KafkaConsumer[] = [];

  constructor(config: ConfigService) {
    this.cfg = readKafkaConfig({
      KAFKA_ENABLED: config.get<string>('KAFKA_ENABLED'),
      KAFKA_BROKERS: config.get<string>('KAFKA_BROKERS'),
      KAFKA_CLIENT_ID: config.get<string>('KAFKA_CLIENT_ID'),
      KAFKA_CONSUMERS_ENABLED: config.get<string>('KAFKA_CONSUMERS_ENABLED'),
      KAFKA_RETRY_BASE_MS: config.get<string>('KAFKA_RETRY_BASE_MS'),
    });
  }

  /** Module nghiệp vụ gọi trong onModuleInit; mọi consumer được chạy sau khi ứng dụng khởi động xong. */
  registerConsumer(def: ConsumerDefinition): void {
    this.definitions.push(def);
  }

  onApplicationBootstrap(): void {
    if (!this.cfg.enabled) {
      this.logger.log('KAFKA_ENABLED=false: không mở kết nối Kafka');
      return;
    }
    // KHÔNG await: backend không được chờ hay sập vì Kafka (quyết định 13).
    void this.connectLoop();
  }

  async publish<T>(
    topic: string,
    envelope: EventEnvelope<T>,
    key: string,
  ): Promise<void> {
    if (!this.cfg.enabled) return;
    if (!this.producerReady || !this.producer) {
      throw new Error('Kafka producer chưa sẵn sàng');
    }
    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(envelope),
          headers: envelopeHeaders(envelope),
        },
      ],
    });
  }

  // ---- kết nối ở nền ----

  private async connectLoop(): Promise<void> {
    let delay = 2_000;
    while (!this.stopping) {
      try {
        await this.connectOnce();
        return;
      } catch (error) {
        this.logger.warn(
          `Kafka chưa sẵn sàng (${errMsg(error)}); thử lại sau ${delay / 1000}s`,
        );
        await this.sleep(delay);
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
      }
    }
  }

  /** Mỗi bước idempotent: lần thử lại chỉ làm phần còn thiếu. */
  private async connectOnce(): Promise<void> {
    const client = (this.client ??= createKafkaClient(this.cfg, {
      warn: (m) => this.logger.warn(m),
      error: (m) => this.logger.error(m),
    }));

    if (!this.producer) {
      const producer = client.producer();
      try {
        await producer.connect();
      } catch (error) {
        await producer.disconnect().catch(() => undefined);
        throw error;
      }
      this.producer = producer;
    }

    if (!this.topicsReady) {
      await this.ensureTopics(client);
      this.topicsReady = true;
    }
    if (!this.producerReady) {
      this.producerReady = true;
      this.logger.log('Kafka producer sẵn sàng');
    }

    if (this.cfg.consumersEnabled) {
      await this.startPendingConsumers(client);
    } else if (this.definitions.length > 0) {
      this.logger.warn('KAFKA_CONSUMERS_ENABLED=false: chỉ publish, không tiêu thụ');
    }
  }

  private async ensureTopics(client: KafkaClient): Promise<void> {
    const admin = client.admin();
    await admin.connect();
    try {
      // createTopics bỏ qua topic đã tồn tại nên chạy lại không lỗi (KF5).
      await admin.createTopics({ topics: TOPIC_SPECS.map((t) => ({ ...t })) });
      this.logger.log(`Đã bảo đảm ${TOPIC_SPECS.length} topic`);
    } finally {
      await admin.disconnect().catch(() => undefined);
    }
  }

  private async startPendingConsumers(client: KafkaClient): Promise<void> {
    for (const def of this.definitions) {
      if (this.started.has(def)) continue;
      const consumer = client.consumer(def.groupId);
      try {
        await consumer.connect();
        await consumer.subscribe({ topics: [def.topic] });
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            const incoming = toIncoming(topic, partition, message);
            try {
              await def.handle(incoming);
            } catch (error) {
              // TẠM (ngày 2): ghi log rồi bỏ qua. Ngày 4 thay bằng retry + dead-letter.
              this.logger.error(
                `Consumer ${def.groupId} lỗi ${topic}[${partition}]@${incoming.offset}: ${errMsg(error)}`,
              );
            }
          },
        });
      } catch (error) {
        await consumer.disconnect().catch(() => undefined);
        throw error;
      }
      this.consumers.push(consumer);
      this.started.add(def);
      this.logger.log(`Consumer ${def.groupId} đang nghe ${def.topic}`);
    }
  }

  // ---- tắt an toàn (cần app.enableShutdownHooks()) ----

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.stopping = true;
    this.producerReady = false;
    this.wake?.();
    for (const consumer of this.consumers) {
      try {
        await consumer.disconnect();
        this.logger.log(`Đã ngắt consumer (${signal ?? 'shutdown'})`);
      } catch (error) {
        this.logger.warn(`Ngắt consumer lỗi: ${errMsg(error)}`);
      }
    }
    if (this.producer) {
      try {
        await this.producer.disconnect();
        this.logger.log('Đã ngắt producer');
      } catch (error) {
        this.logger.warn(`Ngắt producer lỗi: ${errMsg(error)}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
