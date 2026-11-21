import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { COUNTER_STORE, type CounterStore } from '../redis/cache.types';
import { RedisModule } from '../redis/redis.module';
import { UserModule } from '../user/user.module';
import { ChatAuthService } from './chat-auth.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  CHAT_RATE_LIMIT,
  CHAT_RATE_WINDOW_MS,
  MessageRateLimiter,
} from './message-rate-limiter';
import { PassportModule } from '@nestjs/passport';
import { AdminChatController } from './admin-chat.controller';
import { ChatController } from './chat.controller';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    UserModule,
    PassportModule.register({}),
    JwtModule.register({}),
  ],
  controllers: [ChatController, AdminChatController],
  providers: [
    ChatGateway,
    ChatAuthService,
    ChatService,
    {
      provide: MessageRateLimiter,
      useFactory: (store: CounterStore) =>
        new MessageRateLimiter(CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, store),
      inject: [COUNTER_STORE],
    },
  ],
  exports: [ChatGateway],
})
export class ChatModule {}
