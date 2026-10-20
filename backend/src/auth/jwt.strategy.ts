import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../common/auth/current-user.decorator';
import { UserService } from '../user/user.service';

interface JwtPayload {
  sub: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!Number.isInteger(payload.sub)) throw new UnauthorizedException();
    const state = await this.users.findAuthState(payload.sub);
    // Khóa có hiệu lực ngay; vai trò lấy từ DB, không tin vai trò trong token.
    if (!state || !state.isActive) throw new UnauthorizedException();
    return { id: state.id, role: state.role };
  }
}
