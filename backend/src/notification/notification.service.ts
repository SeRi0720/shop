import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../kafka/event-bus';
import { buildEnvelope, parseOrderCreated } from '../kafka/events';
import { IdempotencyService } from '../kafka/idempotency.service';
import type { IncomingMessage } from '../kafka/kafka.client';
import { TOPICS } from '../kafka/kafka.constants';
import { KafkaService } from '../kafka/kafka.service';
import {
  KIND_ADMIN_NEW_ORDER,
  NOTIFICATION,
  deriveAdminNewOrderEventId,
  type NotificationData,
} from './notification.events';

export const BUILDER_GROUP = 'shop.notification-builder';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    private readonly kafka: KafkaService,
    private readonly idempotency: IdempotencyService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  onModuleInit(): void {
    this.kafka.registerConsumer({
      groupId: BUILDER_GROUP,
      topic: TOPICS.ORDER_CREATED,
      handle: (message) => this.buildFromOrderCreated(message),
    });
  }

  /**
   * Nấc 1: order.created -> notification.
   * Ở đây publish PHẢI await (khác OrderService): lỗi phải làm consumer retry, không được nuốt.
   * Consumer chỉ dùng dữ liệu trong sự kiện, không truy vấn bảng của module khác.
   */
  async buildFromOrderCreated(message: IncomingMessage): Promise<void> {
    const event = parseOrderCreated(message.value); // sai hợp đồng -> InvalidEventError (không retry)

    await this.idempotency.runOnce(BUILDER_GROUP, event.eventId, async () => {
      const data: NotificationData = {
        kind: KIND_ADMIN_NEW_ORDER,
        causationId: event.eventId,
        orderId: event.data.orderId,
        totalAmount: event.data.totalAmount,
        paymentMethod: event.data.paymentMethod,
      };
      const notification = buildEnvelope(NOTIFICATION, data, {
        eventId: deriveAdminNewOrderEventId(event.eventId),
      });
      await this.bus.publish(
        TOPICS.NOTIFICATION,
        notification,
        String(event.data.orderId),
      );
    });
  }
}
