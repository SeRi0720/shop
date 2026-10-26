import { Inject, Injectable } from '@nestjs/common';
import type { EventEnvelope } from '../kafka/events';
import {
  ADMIN_EMITTER,
  type AdminEmitter,
  type NotificationChannel,
} from './notification-channel';
import type { NotificationData } from './notification.events';

export const SOCKET_EVENT = 'notification:new';

/** Kênh (b): Socket.IO tới phòng admins. Giao diện admin lắng nghe SOCKET_EVENT (ngày 5). */
@Injectable()
export class SocketChannel implements NotificationChannel {
  readonly name = 'socket';

  constructor(@Inject(ADMIN_EMITTER) private readonly admins: AdminEmitter) {}

  send(event: EventEnvelope<NotificationData>): Promise<void> {
    this.admins.emitToAdmins(SOCKET_EVENT, {
      eventId: event.eventId,
      kind: event.data.kind,
      orderId: event.data.orderId,
      totalAmount: event.data.totalAmount,
      paymentMethod: event.data.paymentMethod,
      occurredAt: event.occurredAt,
    });
    return Promise.resolve();
  }
}
