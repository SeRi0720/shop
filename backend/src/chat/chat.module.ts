import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { ChatAuthService } from './chat-auth.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [PrismaModule, UserModule, JwtModule.register({})],
  providers: [ChatGateway, ChatAuthService],
})
export class ChatModule {}
