import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_QTY_PER_LINE } from '../cart.constants';

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, maximum: MAX_QTY_PER_LINE })
  @IsInt()
  @Min(1)
  @Max(MAX_QTY_PER_LINE)
  quantity: number;
}
