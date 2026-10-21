import type { Socket } from 'socket.io';
import type { ChatAuthService } from './chat-auth.service';
import { ChatGateway } from './chat.gateway';
import type { ChatService } from './chat.service';
import type { MessageRateLimiter } from './message-rate-limiter';

describe('ChatGateway.handleSend', () => {
  const auth = { isActive: jest.fn() };
  const chat = { sendMessage: jest.fn() };
  const limiter = { tryConsume: jest.fn() };
  const emit = jest.fn();
  const to = jest.fn();
  let gateway: ChatGateway;

  const socket = (expOffsetSec = 600) =>
    ({
      data: {
        user: { id: 5, role: 'USER' },
        exp: Math.floor(Date.now() / 1000) + expOffsetSec,
      },
    }) as unknown as Socket;

  beforeEach(() => {
    [auth.isActive, chat.sendMessage, limiter.tryConsume, emit, to].forEach(
      (f) => f.mockReset(),
    );
    to.mockReturnValue({ to, emit });
    limiter.tryConsume.mockReturnValue(true);
    gateway = new ChatGateway(
      auth as unknown as ChatAuthService,
      chat as unknown as ChatService,
      limiter as unknown as MessageRateLimiter,
    );
    (gateway as unknown as { server: unknown }).server = { to };
  });

  it('tài khoản bị khóa: ACCOUNT_DISABLED, không lưu, không phát', async () => {
    auth.isActive.mockResolvedValue(false);
    const ack = await gateway.handleSend(socket(), { content: 'xin chào' });
    expect(ack).toMatchObject({ ok: false, code: 'ACCOUNT_DISABLED' });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
  });

  it('tài khoản hoạt động: lưu rồi phát message:new', async () => {
    auth.isActive.mockResolvedValue(true);
    chat.sendMessage.mockResolvedValue({ id: 1, customerId: 5 });
    const ack = await gateway.handleSend(socket(), { content: 'xin chào' });
    expect(ack).toMatchObject({ ok: true });
    expect(to).toHaveBeenCalledWith('chat:5');
    expect(emit).toHaveBeenCalledWith('message:new', { id: 1, customerId: 5 });
  });

  it('lỗi DB khi kiểm trạng thái: INTERNAL, không lưu', async () => {
    auth.isActive.mockRejectedValue(new Error('db down'));
    const ack = await gateway.handleSend(socket(), { content: 'xin chào' });
    expect(ack).toMatchObject({ ok: false, code: 'INTERNAL' });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('token hết hạn được xét trước, không chạm DB', async () => {
    const ack = await gateway.handleSend(socket(-10), { content: 'xin chào' });
    expect(ack).toMatchObject({ ok: false, code: 'TOKEN_EXPIRED' });
    expect(auth.isActive).not.toHaveBeenCalled();
  });
});
