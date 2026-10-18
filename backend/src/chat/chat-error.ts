export type ChatErrorCode =
  | 'INVALID_PAYLOAD'
  | 'INVALID_CONTENT'
  | 'NO_CONVERSATION'
  | 'CUSTOMER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TOKEN_EXPIRED'
  | 'INTERNAL';

export const CHAT_ERROR_MESSAGES: Record<ChatErrorCode, string> = {
  INVALID_PAYLOAD: 'Dữ liệu tin nhắn không hợp lệ',
  INVALID_CONTENT: 'Tin nhắn phải dài từ 1 đến 2000 ký tự',
  NO_CONVERSATION: 'Khách này chưa có hội thoại, không thể chủ động nhắn',
  CUSTOMER_NOT_FOUND: 'Không tìm thấy khách hàng',
  RATE_LIMITED: 'Bạn gửi quá nhanh, vui lòng chờ vài giây',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn, đang làm mới',
  INTERNAL: 'Có lỗi hệ thống, vui lòng thử lại',
};

export class ChatError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    message: string = CHAT_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = 'ChatError';
  }
}
