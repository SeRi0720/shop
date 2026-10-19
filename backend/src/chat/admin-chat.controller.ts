import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { ChatService } from './chat.service';
import { InboxQueryDto, MessageHistoryQueryDto } from './dto/chat-query.dto';

@ApiTags('admin-chat')
@ApiBearerAuth()
@Controller('admin/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations') conversations(@Query() query: InboxQueryDto) {
    return this.chat.listConversations(query);
  }

  @Get('conversations/:customerId/messages') messages(
    @Param('customerId', ParseIdPipe) customerId: number,
    @Query() query: MessageHistoryQueryDto,
  ) {
    return this.chat.listConversationMessages(customerId, query);
  }
}
