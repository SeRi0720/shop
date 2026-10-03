import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsSpecs } from './specs.validator';

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(5000) description?: string;

  // Int của Postgres tối đa ~2,147 tỷ; giá ≥ 1 (không có sản phẩm giá 0)
  @IsInt() @Min(1) @Max(2_000_000_000) price: number;

  @IsInt() @Min(0) @Max(1_000_000) stock: number;

  @IsInt() categoryId: number;
  @IsInt() brandId: number;

  @IsOptional() @IsSpecs() specs?: Record<string, string>;
}
