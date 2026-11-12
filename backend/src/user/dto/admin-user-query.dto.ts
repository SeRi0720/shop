import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Sanitize } from '../../common/sanitize';

export const USER_STATUS_FILTERS = ['active', 'locked'] as const;

export class AdminUserQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: 'Email, họ tên hoặc số điện thoại' })
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: USER_STATUS_FILTERS })
  @IsOptional()
  @IsIn(USER_STATUS_FILTERS)
  status?: (typeof USER_STATUS_FILTERS)[number];
}
