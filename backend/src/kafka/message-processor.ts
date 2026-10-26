import { InvalidEventError } from './events';
import type { IncomingMessage } from './kafka.client';

export interface ProcessorLogger {
  warn(message: string): void;
  error(message: string): void;
}

export interface ProcessorDeps {
  /** Chờ đầu tiên; gấp đôi mỗi lần (1s, 2s, 4s với mặc định). */
  baseDelayMs: number;
  /** Số lần thử lại SAU lần đầu (quyết định 9: 3). */
  maxRetries: number;
  /** Chờ trước khi ném lỗi khi gửi dead-letter thất bại, để vòng giao lại không quay vòng tốc độ cao. */
  dltFailureDelayMs: number;
  sleep: (ms: number) => Promise<void>;
  isStopping: () => boolean;
  publishDlt: (
    topic: string,
    key: string | null,
    value: string | null,
    headers: Record<string, string>,
  ) => Promise<void>;
  now: () => Date;
  logger: ProcessorLogger;
}

export interface Processable {
  groupId: string;
  dltTopic: string;
  handle(message: IncomingMessage): Promise<void>;
}

const MAX_ERROR_HEADER = 500;

/**
 * Quy tắc commit offset (quyết định 9). Hàm này RESOLVE khi: xử lý xong, hoặc đã gửi
 * dead-letter thành công. Thư viện chỉ lưu offset sau khi hàm resolve, nên đó là lúc "commit".
 * Hàm này NÉM LỖI khi: gửi dead-letter thất bại, hoặc ứng dụng đang tắt giữa lúc chờ retry.
 * Ném lỗi nghĩa là không commit và message được giao lại.
 */
export class MessageProcessor {
  constructor(private readonly deps: ProcessorDeps) {}

  async process(def: Processable, message: IncomingMessage): Promise<void> {
    const { maxRetries, baseDelayMs, logger } = this.deps;
    let attempts = 0;

    for (;;) {
      attempts++;
      try {
        await def.handle(message);
        return;
      } catch (error) {
        const retryable = !(error instanceof InvalidEventError);
        if (!retryable || attempts > maxRetries) {
          await this.deadLetter(def, message, error, attempts);
          return;
        }
        const delay = baseDelayMs * 2 ** (attempts - 1);
        logger.warn(
          `${def.groupId} lỗi ở ${where(message)} (lần ${attempts}/${maxRetries + 1}): ${errMsg(error)}; thử lại sau ${delay}ms`,
        );
        await this.deps.sleep(delay);
        if (this.deps.isStopping()) {
          throw new Error('Ứng dụng đang tắt: hoãn xử lý, message sẽ được giao lại');
        }
      }
    }
  }

  private async deadLetter(
    def: Processable,
    message: IncomingMessage,
    error: unknown,
    attempts: number,
  ): Promise<void> {
    const headers: Record<string, string> = {
      ...message.headers,
      'x-original-topic': message.topic,
      'x-original-partition': String(message.partition),
      'x-original-offset': message.offset,
      'x-error': errMsg(error).slice(0, MAX_ERROR_HEADER),
      'x-attempts': String(attempts),
      'x-failed-at': this.deps.now().toISOString(),
    };
    try {
      await this.deps.publishDlt(def.dltTopic, message.key, message.value, headers);
    } catch (dltError) {
      this.deps.logger.error(
        `${def.groupId}: gửi ${def.dltTopic} cũng lỗi cho ${where(message)} (${errMsg(dltError)}); không commit, message sẽ được giao lại`,
      );
      await this.deps.sleep(this.deps.dltFailureDelayMs);
      throw dltError;
    }
    this.deps.logger.error(
      `${def.groupId}: chuyển ${def.dltTopic} cho ${where(message)} sau ${attempts} lần thử: ${errMsg(error)}`,
    );
  }
}

const where = (m: IncomingMessage) => `${m.topic}[${m.partition}]@${m.offset}`;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
