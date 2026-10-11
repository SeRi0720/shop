import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ADMIN_TARGET_STATUSES, type AdminTargetStatus } from '../order-state';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ADMIN_TARGET_STATUSES })
  @IsIn(ADMIN_TARGET_STATUSES)
  status: AdminTargetStatus;
}
