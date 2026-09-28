import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { UserService } from '../user/user.service';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.util';
import { RefreshTokenService } from './refresh-token.service';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const passwordHash = await hashPassword(dto.password);
    const user = await this.userService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
    });
    return UserResponseDto.from(user);
  }
  async validateUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const isMatch = await verifyPassword(user.passwordHash, password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return user;
  }
  private signAccessToken(user: { id: number; role: string }) {
    return this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as StringValue,
      },
    );
  }
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    const accessToken = await this.signAccessToken(user);
    const refresh = await this.refreshTokens.issue(user.id);
    return { accessToken, refresh };
  }
  async refresh(rawToken: string | undefined) {
    const invalid = () =>
      new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    if (!rawToken) throw invalid();
    const record = await this.refreshTokens.findByToken(rawToken);
    if (!record || record.revokedAt || record.expiresAt <= new Date()) {
      throw invalid();
    }
    const user = await this.userService.findById(record.userId);
    if (!user || !user.isActive) throw invalid();
    const revoked = await this.refreshTokens.revokeIfActive(record.id);
    if (!revoked) throw invalid();
    const accessToken = await this.signAccessToken(user);
    const refresh = await this.refreshTokens.issue(user.id);
    return { accessToken, refresh };
  }
  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const record = await this.refreshTokens.findByToken(rawToken);
    if (record && !record.revokedAt) {
      await this.refreshTokens.revokeIfActive(record.id);
    }
  }
}
