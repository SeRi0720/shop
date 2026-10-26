import { Module } from '@nestjs/common';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatModule } from '../chat/chat.module';
import { KafkaModule } from '../kafka/kafka.module';
import { LogChannel } from './log.channel';
import { ADMIN_EMITTER, NOTIFICATION_CHANNELS } from './notification-channel';
import { NotificationService } from './notification.service';
import { SocketChannel } from './socket.channel';

@Module({
  imports: [KafkaModule, ChatModule],
  providers: [
    NotificationService,
    LogChannel,
    SocketChannel,
    { provide: ADMIN_EMITTER, useExisting: ChatGateway },
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (socket: SocketChannel, log: LogChannel) => [socket, log],
      inject: [SocketChannel, LogChannel],
    },
  ],
})
export class NotificationModule {}
