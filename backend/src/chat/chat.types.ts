import type { ChatErrorCode } from './chat-error';

export interface ChatMessage {
  id: number;
  conversationId: number;
  customerId: number;
  senderId: number;
  fromAdmin: boolean;
  content: string;
  createdAt: Date; // qua socket và REST đều thành chuỗi ISO
}

export type SendAck =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: ChatErrorCode; message: string };
