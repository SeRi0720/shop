import { UnauthorizedException } from '@nestjs/common';
import type { UserService } from '../user/user.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const findAuthState = jest.fn();
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET ??= 'test-secret';
    strategy = new JwtStrategy({ findAuthState } as unknown as UserService);
  });
  beforeEach(() => findAuthState.mockReset());

  it('người dùng hoạt động: trả { id, role } lấy từ DB', async () => {
    findAuthState.mockResolvedValue({ id: 7, role: 'ADMIN', isActive: true });
    await expect(strategy.validate({ sub: 7 })).resolves.toEqual({
      id: 7,
      role: 'ADMIN',
    });
  });

  it('không tồn tại: 401', async () => {
    findAuthState.mockResolvedValue(null);
    await expect(strategy.validate({ sub: 7 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('bị khóa: 401', async () => {
    findAuthState.mockResolvedValue({ id: 7, role: 'USER', isActive: false });
    await expect(strategy.validate({ sub: 7 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sub không phải số nguyên: 401, không chạm DB', async () => {
    await expect(
      strategy.validate({ sub: '7' as unknown as number }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findAuthState).not.toHaveBeenCalled();
  });

  it('lỗi DB: ném tiếp, không biến thành 401', async () => {
    findAuthState.mockRejectedValue(new Error('db down'));
    const err = await strategy.validate({ sub: 7 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(UnauthorizedException);
  });
});
