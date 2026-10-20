import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserService } from './user.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get() list(@Query() query: AdminUserQueryDto) {
    return this.userService.listForAdmin(query);
  }

  @Patch(':id/status') setStatus(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.userService.setActive(id, dto.isActive);
  }
}
