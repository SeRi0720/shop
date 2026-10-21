import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';

export interface HandshakeUser {
  id: number;
  role: 'USER' | 'ADMIN';
  exp: number;
}

@Injectable()
export class ChatAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UserService,
  ) {}

  /**
   * Trả user nếu hợp lệ, ngược lại null. Mọi lý do từ chối cho cùng một kết quả
   * để không lộ thông tin. Lỗi DB thì ném tiếp (không biến thành "chưa đăng nhập").
   */
  async authenticate(token: unknown): Promise<HandshakeUser | null> {
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > 2048
    ) {
      return null;
    }
    let payload: { sub?: unknown; exp?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
    } catch {
      return null; // sai chữ ký, hết hạn, sai định dạng
    }
    if (!Number.isInteger(payload.sub) || typeof payload.exp !== 'number') {
      return null;
    }
    const user = await this.users.findById(payload.sub as number);
    if (!user || !user.isActive) return null;
    // Vai trò lấy từ DB, không tin vai trò trong token.
    return { id: user.id, role: user.role, exp: payload.exp };
  }

  /** Socket đã kết nối không đi qua JwtStrategy nên kiểm lại ở mỗi lần gửi. Lỗi DB thì ném tiếp. */
  async isActive(userId: number): Promise<boolean> {
    const state = await this.users.findAuthState(userId);
    return !!state && state.isActive;
  }
}
