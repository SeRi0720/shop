import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatAuthService } from './chat-auth.service';
import { ChatError } from './chat-error';
import {
  CHAT_PATH,
  MAX_HTTP_BUFFER_SIZE,
  ROOM_ADMINS,
  customerRoom,
} from './chat.constants';
import { ChatService } from './chat.service';
import type { SendAck } from './chat.types';
import { MessageRateLimiter } from './message-rate-limiter';
import { parseSendPayload } from './parse-send-payload';

export interface SocketUser {
  id: number;
  role: 'USER' | 'ADMIN';
}

@WebSocketGateway({
  path: CHAT_PATH,
  transports: ['websocket'],
  maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly auth: ChatAuthService,
    private readonly chat: ChatService,
    private readonly limiter: MessageRateLimiter,
  ) {}

  afterInit(server: Server) {
    // Chạy trước khi kết nối được chấp nhận.
    server.use((socket, next) => {
      void this.handshake(socket).then((err) => next(err));
    });
  }

  private async handshake(socket: Socket): Promise<Error | undefined> {
    const token: unknown = socket.handshake.auth?.token;
    try {
      const user = await this.auth.authenticate(token);
      if (!user) {
        this.logger.warn(`Từ chối kết nối ${socket.id} (UNAUTHORIZED)`);
        return new Error('UNAUTHORIZED');
      }
      socket.data.user = { id: user.id, role: user.role } satisfies SocketUser;
      socket.data.exp = user.exp;
      return undefined;
    } catch (error) {
      this.logger.error(`Lỗi khi xác thực kết nối: ${String(error)}`);
      // Khác UNAUTHORIZED để client không đi làm mới token vô ích.
      return new Error('SERVER_ERROR');
    }
  }

  async handleConnection(socket: Socket) {
    const { id, role } = socket.data.user as SocketUser;
    await socket.join(role === 'ADMIN' ? ROOM_ADMINS : customerRoom(id));
    this.logger.log(`Kết nối user=${id} role=${role} socket=${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    const user = socket.data.user as SocketUser | undefined;
    this.logger.log(`Ngắt kết nối user=${user?.id ?? '?'} socket=${socket.id}`);
  }

  @SubscribeMessage('ping')
  ping() {
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() raw: unknown,
  ): Promise<SendAck> {
    const user = socket.data.user as SocketUser;
    try {
      // 1) Token hết hạn: từ chối trước khi lưu (client làm mới rồi gửi lại an toàn)
      const exp = socket.data.exp as unknown;
      if (typeof exp !== 'number' || Date.now() / 1000 >= exp) {
        throw new ChatError('TOKEN_EXPIRED');
      }
      // 2) Tần suất (sau bước 1 để lần gửi lại sau khi làm mới không bị tính hai lần)
      if (!this.limiter.tryConsume(user.id))
        throw new ChatError('RATE_LIMITED');
      if (!(await this.auth.isActive(user.id))) {
        throw new ChatError('ACCOUNT_DISABLED');
      }
      // 3) Kiểm payload rồi lưu
      const payload = parseSendPayload(raw);
      const message = await this.chat.sendMessage({
        senderId: user.id,
        role: user.role,
        ...payload,
      });
      // 4) Chỉ phát SAU khi đã lưu xong; phát lỗi cũng không làm ack thất bại
      try {
        this.server
          .to(customerRoom(message.customerId))
          .to(ROOM_ADMINS)
          .emit('message:new', message);
      } catch (error) {
        this.logger.error(
          `Phát message:new lỗi (tin ${message.id} đã lưu): ${String(error)}`,
        );
      }
      return { ok: true, message };
    } catch (error) {
      return this.failure(error, user.id);
    }
  }

  emitToAdmins(event: string, payload: unknown): void {
    if (!this.server) throw new Error('Socket server chưa khởi tạo');
    this.server.to(ROOM_ADMINS).emit(event, payload);
  }

  private failure(error: unknown, userId: number): SendAck {
    if (error instanceof ChatError) {
      return { ok: false, code: error.code, message: error.message };
    }
    // Không lộ chi tiết cho client; log đầy đủ ở server
    this.logger.error(
      `message:send lỗi user=${userId}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    const internal = new ChatError('INTERNAL');
    return { ok: false, code: internal.code, message: internal.message };
  }
}
