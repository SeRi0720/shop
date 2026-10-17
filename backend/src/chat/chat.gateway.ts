import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatAuthService } from './chat-auth.service';
import {
  CHAT_PATH,
  MAX_HTTP_BUFFER_SIZE,
  ROOM_ADMINS,
  customerRoom,
} from './chat.constants';

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

  constructor(private readonly auth: ChatAuthService) {}

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
}
