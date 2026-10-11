import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order.service';

@ApiTags('admin-orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Patch(':id/status') changeStatus(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.changeStatus(id, dto.status);
  }
}
