import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PHONE_MESSAGE, PHONE_REGEX } from '../../common/phone';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Chuỗi rỗng nghĩa là xóa số điện thoại, nên đổi thành null. */
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A', maxLength: 100 })
  @Transform(trim)
  // Không dùng IsOptional: nó bỏ qua cả null, mà cột full_name không cho null (sẽ thành lỗi 500).
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    example: '0912345678',
    nullable: true,
    description: 'null hoặc chuỗi rỗng để xóa số điện thoại',
  })
  @Transform(trimOrNull)
  @IsOptional() // null hợp lệ: nghĩa là xóa
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string | null;
}
