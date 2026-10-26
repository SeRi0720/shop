import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { ChatAuthService } from './chat-auth.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageRateLimiter } from './message-rate-limiter';
import { PassportModule } from '@nestjs/passport';
import { AdminChatController } from './admin-chat.controller';
import { ChatController } from './chat.controller';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    PassportModule.register({}),
    JwtModule.register({}),
  ],
  controllers: [ChatController, AdminChatController],
  providers: [
    ChatGateway,
    ChatAuthService,
    ChatService,
    { provide: MessageRateLimiter, useFactory: () => new MessageRateLimiter() },
  ],
  exports: [ChatGateway],
})
export class ChatModule {}
