import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

async function check(body: unknown) {
  const dto = plainToInstance(UpdateProfileDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, errors };
}

describe('UpdateProfileDto', () => {
  it('chấp nhận họ tên và số điện thoại hợp lệ, cắt khoảng trắng', async () => {
    const { dto, errors } = await check({
      fullName: '  Nguyễn Văn A ',
      phone: ' 0912345678 ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.fullName).toBe('Nguyễn Văn A');
    expect(dto.phone).toBe('0912345678');
  });

  it('số điện thoại rỗng hoặc toàn khoảng trắng thành null (xóa số)', async () => {
    for (const phone of ['', '   ', null]) {
      const { dto, errors } = await check({ phone });
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBeNull();
    }
  });

  it('từ chối số điện thoại sai định dạng', async () => {
    for (const phone of ['123', '0912abc678', '+8491234567', '09123456789']) {
      const { errors } = await check({ phone });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('từ chối họ tên rỗng, toàn khoảng trắng, null hoặc quá 100 ký tự', async () => {
    for (const fullName of ['', '   ', null, 'a'.repeat(101)]) {
      const { errors } = await check({ fullName });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('không gửi trường nào vẫn hợp lệ, trường lạ bị bỏ', async () => {
    const { dto, errors } = await check({
      fullName: 'A',
      role: 'ADMIN',
      email: 'x@y.z',
      isActive: false,
    });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('role');
    expect(dto).not.toHaveProperty('email');
    expect(dto).not.toHaveProperty('isActive');
    expect((await check({})).errors).toHaveLength(0);
  });
});
