import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto sanitize', () => {
  it('fullName được làm sạch, password giữ nguyên (kể cả khoảng trắng đầu/cuối)', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: '  Mat khau 123  ',
      fullName: 'Nguye\u0302\u0303n\u200B Văn A ',
    });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.fullName).toBe('Nguyễn Văn A');
    expect(dto.password).toBe('  Mat khau 123  ');
  });

  it('fullName chỉ gồm ký tự vô hình bị từ chối', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: '12345678',
      fullName: '\u200B\u200B',
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
