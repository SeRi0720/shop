import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orderService.create(user.id, dto);
  }

  @Get(':id') findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.orderService.findOneForUser(user.id, id);
  }
}
