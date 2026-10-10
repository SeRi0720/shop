import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const PAYMENT_METHODS = ['COD', 'VNPAY'] as const;

export class CreateOrderDto {
  @ApiProperty({ example: 'Name' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  shippingName: string;

  @ApiProperty({ example: '0912345678' })
  @Transform(trim)
  @Matches(/^(0|\+84)\d{9}$/, { message: 'Số điện thoại không hợp lệ' })
  shippingPhone: string;

  @ApiProperty({ example: 'Address' })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  shippingAddress: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'COD' })
  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];
}
