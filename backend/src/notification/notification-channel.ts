import type { EventEnvelope } from '../kafka/events';
import type { NotificationData } from './notification.events';

export interface NotificationChannel {
  readonly name: string;
  /** Ném lỗi nếu gửi thất bại: nấc 2 sẽ retry rồi dead-letter. */
  send(event: EventEnvelope<NotificationData>): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

/** Phần hẹp của ChatModule mà NotificationModule cần; không để lộ socket (quyết định 10). */
export interface AdminEmitter {
  emitToAdmins(event: string, payload: unknown): void;
}
export const ADMIN_EMITTER = Symbol('ADMIN_EMITTER');
