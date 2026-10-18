import type { Server, Socket } from 'socket.io';
import type { ChatAuthService } from './chat-auth.service';
import { ChatError } from './chat-error';
import { ChatGateway } from './chat.gateway';
import type { ChatService } from './chat.service';
import type { ChatMessage } from './chat.types';
import type { MessageRateLimiter } from './message-rate-limiter';

const MESSAGE: ChatMessage = {
  id: 1,
  conversationId: 100,
  customerId: 7,
  senderId: 7,
  fromAdmin: false,
  content: 'xin chào',
  createdAt: new Date('2026-10-17T03:00:00Z'),
};
const EXP = 2_000_000_000; // giây, xa trong tương lai

function setup() {
  const order: string[] = [];
  const rooms: string[] = [];
  const emit = jest.fn(() => {
    order.push('emit');
  });
  const op = {
    to: (r: string) => {
      rooms.push(r);
      return op;
    },
    emit,
  };
  const server = {
    to: (r: string) => {
      rooms.push(r);
      return op;
    },
  };

  const chat = {
    sendMessage: jest.fn(() => {
      order.push('save');
      return Promise.resolve(MESSAGE);
    }),
  };
  const limiter = { tryConsume: jest.fn(() => true) };
  const gateway = new ChatGateway(
    {} as ChatAuthService,
    chat as unknown as ChatService,
    limiter as unknown as MessageRateLimiter,
  );
  gateway.server = server as unknown as Server;
  const socket = (exp = EXP) =>
    ({ data: { user: { id: 7, role: 'USER' }, exp } }) as unknown as Socket;
  return { gateway, chat, limiter, emit, rooms, order, socket };
}

describe('ChatGateway.handleSend', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lưu xong mới phát, tới đúng hai room, ack ok', async () => {
    const { gateway, chat, emit, rooms, order, socket } = setup();
    const ack = await gateway.handleSend(socket(), { content: 'xin chào' });
    expect(ack).toEqual({ ok: true, message: MESSAGE });
    expect(order).toEqual(['save', 'emit']);
    expect(rooms.sort()).toEqual(['admins', 'chat:7']);
    expect(emit).toHaveBeenCalledWith('message:new', MESSAGE);
    expect(chat.sendMessage).toHaveBeenCalledWith({
      senderId: 7,
      role: 'USER',
      content: 'xin chào',
      customerId: undefined,
    });
  });

  it('lỗi nghiệp vụ: ack đúng mã, không phát', async () => {
    const { gateway, chat, emit, socket } = setup();
    chat.sendMessage.mockRejectedValueOnce(new ChatError('NO_CONVERSATION'));
    const ack = await gateway.handleSend(socket(), { content: 'x' });
    expect(ack).toMatchObject({ ok: false, code: 'NO_CONVERSATION' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('lỗi bất ngờ: INTERNAL, không lộ chi tiết, không phát', async () => {
    const { gateway, chat, emit, socket } = setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    chat.sendMessage.mockRejectedValueOnce(new Error('db down: password=abc'));
    const ack = await gateway.handleSend(socket(), { content: 'x' });
    expect(ack).toMatchObject({ ok: false, code: 'INTERNAL' });
    expect(JSON.stringify(ack)).not.toContain('db down');
    expect(emit).not.toHaveBeenCalled();
  });

  it('token hết hạn: TOKEN_EXPIRED, không tính tần suất, không gọi service', async () => {
    const { gateway, chat, limiter, socket } = setup();
    jest.spyOn(Date, 'now').mockReturnValue((EXP + 1) * 1000);
    const ack = await gateway.handleSend(socket(), { content: 'x' });
    expect(ack).toMatchObject({ ok: false, code: 'TOKEN_EXPIRED' });
    expect(limiter.tryConsume).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('vượt tần suất: RATE_LIMITED, không gọi service', async () => {
    const { gateway, chat, limiter, socket } = setup();
    limiter.tryConsume.mockReturnValueOnce(false);
    const ack = await gateway.handleSend(socket(), { content: 'x' });
    expect(ack).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('payload sai: INVALID_PAYLOAD / INVALID_CONTENT, không gọi service', async () => {
    const { gateway, chat, socket } = setup();
    expect(await gateway.handleSend(socket(), 'abc')).toMatchObject({
      code: 'INVALID_PAYLOAD',
    });
    expect(
      await gateway.handleSend(socket(), { content: '   ' }),
    ).toMatchObject({ code: 'INVALID_CONTENT' });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('phát lỗi sau khi đã lưu: ack vẫn ok', async () => {
    const { gateway, emit, socket } = setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    emit.mockImplementationOnce(() => {
      throw new Error('emit hỏng');
    });
    expect(await gateway.handleSend(socket(), { content: 'x' })).toMatchObject({
      ok: true,
    });
  });
});
