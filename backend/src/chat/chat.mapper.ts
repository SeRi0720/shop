import type { ChatMessage } from './chat.types';

export function toChatMessage(
  row: {
    id: number;
    conversationId: number;
    senderId: number;
    content: string;
    createdAt: Date;
  },
  customerId: number,
): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    customerId,
    senderId: row.senderId,
    fromAdmin: row.senderId !== customerId,
    content: row.content,
    createdAt: row.createdAt,
  };
}
