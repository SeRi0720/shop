import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { ChatAuthService } from './chat-auth.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageRateLimiter } from './message-rate-limiter';

@Module({
  imports: [PrismaModule, UserModule, JwtModule.register({})],
  providers: [
    ChatGateway,
    ChatAuthService,
    ChatService,
    { provide: MessageRateLimiter, useFactory: () => new MessageRateLimiter() },
  ],
})
export class ChatModule {}
