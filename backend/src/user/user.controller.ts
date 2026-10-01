import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/auth/current-user.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get('me') @UseGuards(JwtAuthGuard) async me(
    @CurrentUser() authUser: AuthUser,
  ) {
    const user = await this.userService.findById(authUser.id);
    if (!user) throw new UnauthorizedException();
    return UserResponseDto.from(user);
  }
}
