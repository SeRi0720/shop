import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

const base = {
  shippingName: 'Nguyễn Văn A',
  shippingPhone: '0912345678',
  shippingAddress: '1 Đại Cồ Việt, Hà Nội',
  paymentMethod: 'COD',
};

async function check(over: Record<string, unknown>) {
  const dto = plainToInstance(CreateOrderDto, { ...base, ...over });
  return { dto, errors: await validate(dto, { whitelist: true }) };
}

describe('CreateOrderDto sanitize', () => {
  it('note giữ xuống dòng, tên và địa chỉ đổi tab/xuống dòng thành khoảng trắng', async () => {
    const { dto, errors } = await check({
      note: 'Giao giờ hành chính\nGọi trước',
      shippingName: 'Nguyễn\tVăn A',
      shippingAddress: '1 Đại Cồ Việt,\nHà Nội',
    });
    expect(errors).toHaveLength(0);
    expect(dto.note).toBe('Giao giờ hành chính\nGọi trước');
    expect(dto.shippingName).toBe('Nguyễn Văn A');
    expect(dto.shippingAddress).toBe('1 Đại Cồ Việt, Hà Nội');
  });

  it('shippingPhone bị chèn ký tự vô hình vẫn được làm sạch', async () => {
    const { dto, errors } = await check({ shippingPhone: '\u200B0912345678 ' });
    expect(errors).toHaveLength(0);
    expect(dto.shippingPhone).toBe('0912345678');
  });
});
