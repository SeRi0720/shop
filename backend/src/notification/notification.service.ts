import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../kafka/event-bus';
import { buildEnvelope, parseOrderCreated } from '../kafka/events';
import { IdempotencyService } from '../kafka/idempotency.service';
import type { IncomingMessage } from '../kafka/kafka.client';
import { TOPICS } from '../kafka/kafka.constants';
import { KafkaService } from '../kafka/kafka.service';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from './notification-channel';
import {
  KIND_ADMIN_NEW_ORDER,
  NOTIFICATION,
  deriveAdminNewOrderEventId,
  parseNotification,
  type NotificationData,
} from './notification.events';

export const BUILDER_GROUP = 'shop.notification-builder';
export const SENDER_GROUP = 'shop.notification-sender';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    private readonly kafka: KafkaService,
    private readonly idempotency: IdempotencyService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  onModuleInit(): void {
    this.kafka.registerConsumer({
      groupId: BUILDER_GROUP,
      topic: TOPICS.ORDER_CREATED,
      dltTopic: TOPICS.ORDER_CREATED_DLT,
      handle: (message) => this.buildFromOrderCreated(message),
    });
    this.kafka.registerConsumer({
      groupId: SENDER_GROUP,
      topic: TOPICS.NOTIFICATION,
      dltTopic: TOPICS.NOTIFICATION_DLT,
      handle: (message) => this.sendNotification(message),
    });
  }

  /**
   * Nấc 1: order.created -> notification.
   * publish PHẢI await ở đây (khác OrderService): lỗi phải làm consumer retry, không được nuốt.
   * Chỉ dùng dữ liệu trong sự kiện, không truy vấn bảng của module khác.
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

  /**
   * Nấc 2: notification -> các kênh. Thứ tự kênh theo mảng (socket trước, log sau): dòng log
   * chỉ ghi khi các kênh trước đó đã thành công. Một kênh lỗi thì cả hiệu ứng lỗi, dấu chống
   * trùng bị gỡ, lần retry chạy lại từ đầu (kênh đã gửi có thể gửi lại, chấp nhận được).
   */
  async sendNotification(message: IncomingMessage): Promise<void> {
    const event = parseNotification(message.value);

    await this.idempotency.runOnce(SENDER_GROUP, event.eventId, async () => {
      for (const channel of this.channels) {
        await channel.send(event);
      }
    });
  }
}
