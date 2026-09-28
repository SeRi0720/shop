import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  setRefreshCookie,
} from './auth-cookie';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
  @Post('login') @HttpCode(HttpStatus.OK) async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refresh } = await this.authService.login(dto);
    setRefreshCookie(res, refresh.token, refresh.maxAgeMs);
    return { accessToken };
  }
  @Post('refresh') @HttpCode(HttpStatus.OK) async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { accessToken, refresh } = await this.authService.refresh(
        req.cookies?.[REFRESH_COOKIE],
      );
      setRefreshCookie(res, refresh.token, refresh.maxAgeMs);
      return { accessToken };
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }
  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT) async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
  }
}
