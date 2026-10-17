import { JwtService } from '@nestjs/jwt';
import type { UserService } from '../user/user.service';
import { ChatAuthService } from './chat-auth.service';

const SECRET = 'test-secret-for-chat';
const jwt = new JwtService({});
const nowSec = () => Math.floor(Date.now() / 1000);
const sign = (
  payload: object,
  opts: { secret?: string; expiresIn?: string } = {},
) =>
  jwt.signAsync(payload, {
    secret: opts.secret ?? SECRET,
    ...(opts.expiresIn ? { expiresIn: opts.expiresIn as never } : {}),
  });

describe('ChatAuthService.authenticate', () => {
  const findById = jest.fn();
  let service: ChatAuthService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    findById.mockReset();
    service = new ChatAuthService(jwt, { findById } as unknown as UserService);
  });

  it('token hợp lệ: trả id, role và exp', async () => {
    findById.mockResolvedValue({ id: 5, role: 'USER', isActive: true });
    const token = await sign({ sub: 5, role: 'USER' }, { expiresIn: '15m' });
    const r = await service.authenticate(token);
    expect(r).toMatchObject({ id: 5, role: 'USER' });
    expect(r!.exp).toBeGreaterThan(nowSec());
    expect(findById).toHaveBeenCalledWith(5);
  });

  it.each([undefined, null, '', 123, {}, 'a'.repeat(3000)])(
    'thiếu hoặc sai kiểu token (%p): null, không đụng DB',
    async (bad) => {
      expect(await service.authenticate(bad)).toBeNull();
      expect(findById).not.toHaveBeenCalled();
    },
  );

  it('chuỗi không phải JWT: null', async () => {
    expect(await service.authenticate('abc.def.ghi')).toBeNull();
    expect(findById).not.toHaveBeenCalled();
  });

  it('sai chữ ký: null', async () => {
    const token = await sign(
      { sub: 5, role: 'USER' },
      { secret: 'secret-khac', expiresIn: '15m' },
    );
    expect(await service.authenticate(token)).toBeNull();
    expect(findById).not.toHaveBeenCalled();
  });

  it('token hết hạn: null', async () => {
    const token = await sign({ sub: 5, role: 'USER', exp: nowSec() - 10 });
    expect(await service.authenticate(token)).toBeNull();
    expect(findById).not.toHaveBeenCalled();
  });

  it('sub không phải số nguyên: null, không đụng DB', async () => {
    const token = await sign({ sub: '5', role: 'USER' }, { expiresIn: '15m' });
    expect(await service.authenticate(token)).toBeNull();
    expect(findById).not.toHaveBeenCalled();
  });

  it('user không tồn tại: null', async () => {
    findById.mockResolvedValue(null);
    const token = await sign({ sub: 5, role: 'USER' }, { expiresIn: '15m' });
    expect(await service.authenticate(token)).toBeNull();
  });

  it('tài khoản bị khóa: null', async () => {
    findById.mockResolvedValue({ id: 5, role: 'USER', isActive: false });
    const token = await sign({ sub: 5, role: 'USER' }, { expiresIn: '15m' });
    expect(await service.authenticate(token)).toBeNull();
  });

  it('vai trò lấy từ DB chứ không từ token', async () => {
    findById.mockResolvedValue({ id: 5, role: 'USER', isActive: true });
    const token = await sign({ sub: 5, role: 'ADMIN' }, { expiresIn: '15m' });
    expect((await service.authenticate(token))!.role).toBe('USER');
  });

  it('lỗi DB được ném tiếp, không thành "chưa đăng nhập"', async () => {
    findById.mockRejectedValue(new Error('db down'));
    const token = await sign({ sub: 5, role: 'USER' }, { expiresIn: '15m' });
    await expect(service.authenticate(token)).rejects.toThrow('db down');
  });
});
