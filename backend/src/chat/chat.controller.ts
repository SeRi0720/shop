import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ChatService } from './chat.service';
import { MessageHistoryQueryDto } from './dto/chat-query.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Lịch sử chat của chính người gọi. Không có tham số nào chọn người khác. */
  @Get('messages') messages(
    @CurrentUser() user: AuthUser,
    @Query() query: MessageHistoryQueryDto,
  ) {
    return this.chat.listOwnMessages(user.id, query);
  }
}
