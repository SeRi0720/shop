import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password.util';

jest.mock('./password.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const userService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const refreshTokens = {
    issue: jest.fn(),
    findByToken: jest.fn(),
    revokeIfActive: jest.fn(),
  };

  const activeUser = {
    id: 1,
    email: 'a@b.com',
    passwordHash: 'hashed:12345678',
    fullName: 'A',
    phone: null,
    role: 'USER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const future = () => new Date(Date.now() + 60_000);
  const past = () => new Date(Date.now() - 1_000);

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mocked(hashPassword).mockImplementation(async (p) => `hashed:${p}`);
    jest
      .mocked(verifyPassword)
      .mockImplementation(async (hash, p) => hash === `hashed:${p}`);
    jwtService.signAsync.mockResolvedValue('access.jwt');
    refreshTokens.issue.mockResolvedValue({
      token: 'new-raw',
      expiresAt: future(),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: RefreshTokenService, useValue: refreshTokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    // Ca 1
    it('từ chối email đã tồn tại', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);
      await expect(
        service.register({
          email: 'a@b.com',
          password: '12345678',
          fullName: 'A',
        }),
      ).rejects.toThrow(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });

    // Ca 2: kiểm tra ở DTO, không phải service
    it('DTO từ chối mật khẩu ngắn hơn 8 ký tự', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'a@b.com',
        password: '1234567',
        fullName: 'A',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('lưu bản băm, không lưu mật khẩu gốc, và không trả passwordHash', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(activeUser);
      const res = await service.register({
        email: 'a@b.com',
        password: '12345678',
        fullName: 'A',
      });
      const arg = userService.create.mock.calls[0][0];
      expect(arg.passwordHash).toBe('hashed:12345678');
      expect(arg).not.toHaveProperty('password');
      expect(res).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    // Ca 3 + 4
    it('sai mật khẩu và email không tồn tại trả cùng một thông báo', async () => {
      userService.findByEmail.mockResolvedValueOnce(activeUser);
      const wrongPw = await service
        .login({ email: 'a@b.com', password: 'sai-mat-khau' })
        .catch((e) => e);

      userService.findByEmail.mockResolvedValueOnce(null);
      const noUser = await service
        .login({ email: 'x@y.com', password: '12345678' })
        .catch((e) => e);

      expect(wrongPw).toBeInstanceOf(UnauthorizedException);
      expect(noUser).toBeInstanceOf(UnauthorizedException);
      expect(wrongPw.message).toBe(noUser.message);
    });

    // Ca 5: đúng mật khẩu nhưng bị khóa
    it('từ chối user isActive=false dù đúng mật khẩu', async () => {
      userService.findByEmail.mockResolvedValue({
        ...activeUser,
        isActive: false,
      });
      await expect(
        service.login({ email: 'a@b.com', password: '12345678' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('đăng nhập đúng: trả accessToken và cấp refresh token', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);
      const res = await service.login({
        email: 'a@b.com',
        password: '12345678',
      });
      expect(res.accessToken).toBe('access.jwt');
      expect(jwtService.signAsync.mock.calls[0][0]).toEqual({
        sub: 1,
        role: 'USER',
      });
      expect(refreshTokens.issue).toHaveBeenCalledWith(1);
      expect(res.refresh).toBeDefined();
    });
  });

  describe('refresh', () => {
    // Ca 6
    it.each([
      ['không có cookie', undefined, null],
      ['không tồn tại trong DB', 'raw', null],
      [
        'đã thu hồi/đã dùng',
        'raw',
        { id: 1, userId: 1, revokedAt: new Date(), expiresAt: future() },
      ],
      [
        'hết hạn',
        'raw',
        { id: 1, userId: 1, revokedAt: null, expiresAt: past() },
      ],
    ])('từ chối token %s', async (_label, raw, record) => {
      refreshTokens.findByToken.mockResolvedValue(record);
      await expect(service.refresh(raw as string | undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('từ chối khi user bị khóa', async () => {
      refreshTokens.findByToken.mockResolvedValue({
        id: 1,
        userId: 1,
        revokedAt: null,
        expiresAt: future(),
      });
      userService.findById.mockResolvedValue({
        ...activeUser,
        isActive: false,
      });
      await expect(service.refresh('raw')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('từ chối khi thu hồi thất bại (token vừa bị request khác dùng)', async () => {
      refreshTokens.findByToken.mockResolvedValue({
        id: 1,
        userId: 1,
        revokedAt: null,
        expiresAt: future(),
      });
      userService.findById.mockResolvedValue(activeUser);
      refreshTokens.revokeIfActive.mockResolvedValue(false);
      await expect(service.refresh('raw')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('xoay vòng: thu hồi token cũ rồi cấp token mới', async () => {
      refreshTokens.findByToken.mockResolvedValue({
        id: 7,
        userId: 1,
        revokedAt: null,
        expiresAt: future(),
      });
      userService.findById.mockResolvedValue(activeUser);
      refreshTokens.revokeIfActive.mockResolvedValue(true);

      const res = await service.refresh('raw');

      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith(7);
      expect(refreshTokens.issue).toHaveBeenCalledWith(1);
      expect(res.accessToken).toBe('access.jwt');
    });
  });

  describe('logout', () => {
    // Ca 7
    it('thu hồi token còn hiệu lực', async () => {
      refreshTokens.findByToken.mockResolvedValue({ id: 5, revokedAt: null });
      await service.logout('raw');
      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith(5);
    });

    it('không lỗi khi không có cookie hoặc token đã thu hồi', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(refreshTokens.findByToken).not.toHaveBeenCalled();

      refreshTokens.findByToken.mockResolvedValue({
        id: 5,
        revokedAt: new Date(),
      });
      await expect(service.logout('raw')).resolves.toBeUndefined();
      expect(refreshTokens.revokeIfActive).not.toHaveBeenCalled();
    });
  });
});
