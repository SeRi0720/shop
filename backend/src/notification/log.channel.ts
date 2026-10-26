import { Injectable, Logger } from '@nestjs/common';
import type { EventEnvelope } from '../kafka/events';
import type { NotificationChannel } from './notification-channel';
import type { NotificationData } from './notification.events';

/** Kênh (a): một dòng JSON có cấu trúc. Chỉ có id và số liệu đơn, không có thông tin cá nhân. */
@Injectable()
export class LogChannel implements NotificationChannel {
  readonly name = 'log';
  private readonly logger = new Logger('Notification');

  send(event: EventEnvelope<NotificationData>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        channel: this.name,
        eventId: event.eventId,
        kind: event.data.kind,
        orderId: event.data.orderId,
        totalAmount: event.data.totalAmount,
        paymentMethod: event.data.paymentMethod,
      }),
    );
    return Promise.resolve();
  }
}
