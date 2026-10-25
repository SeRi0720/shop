import type { EventEnvelope } from './events';

/** OrderService chỉ biết interface này (quyết định 6). Bản Kafka và bản giả trong test cùng implement. */
export interface EventBus {
  publish<T>(
    topic: string,
    envelope: EventEnvelope<T>,
    key: string,
  ): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
