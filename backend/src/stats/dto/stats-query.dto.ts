import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const GRANULARITIES = ['day', 'month'] as const;

export class StatsRangeQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'yyyy-MM-dd, giờ VN; mặc định 30 ngày gần nhất',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from phải có dạng yyyy-MM-dd' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'yyyy-MM-dd, giờ VN; mặc định hôm nay',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to phải có dạng yyyy-MM-dd' })
  to?: string;
}

export class RevenueQueryDto extends StatsRangeQueryDto {
  @ApiPropertyOptional({ enum: GRANULARITIES, default: 'day' })
  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity?: (typeof GRANULARITIES)[number];
}

export class TopProductsQueryDto extends StatsRangeQueryDto {
  @ApiPropertyOptional({ default: 5, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
