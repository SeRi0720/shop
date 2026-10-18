import { ChatError } from './chat-error';

export const MAX_CONTENT_LENGTH = 2000;
const MAX_INT = 2_147_483_647; // giới hạn int4 của PostgreSQL

export interface SendPayload {
  content: string;
  customerId?: number;
}

export function parseSendPayload(raw: unknown): SendPayload {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ChatError('INVALID_PAYLOAD');
  }
  const { content, customerId } = raw as Record<string, unknown>;
  if (typeof content !== 'string') throw new ChatError('INVALID_PAYLOAD');

  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_CONTENT_LENGTH) {
    throw new ChatError('INVALID_CONTENT');
  }

  // customerId sai kiểu không làm hỏng payload: USER bỏ qua giá trị này,
  // ADMIN thì ChatService sẽ báo INVALID_PAYLOAD khi nó là undefined.
  const validId =
    typeof customerId === 'number' &&
    Number.isInteger(customerId) &&
    customerId >= 1 &&
    customerId <= MAX_INT
      ? customerId
      : undefined;

  return { content: trimmed, customerId: validId };
}
