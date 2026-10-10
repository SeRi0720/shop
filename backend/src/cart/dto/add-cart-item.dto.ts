import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { UpdateCartItemDto } from './update-cart-item.dto';

export class AddCartItemDto extends UpdateCartItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647) // vượt Int của Postgres sẽ gây lỗi 500 nếu không chặn ở đây
  productId: number;
}
