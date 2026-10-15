import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';
import { OrderListQueryDto } from './dto/order-query.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Ip() ip: string,
  ) {
    return this.orderService.create(user.id, dto, ip);
  }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.orderService.cancel(user.id, id);
  }

  @Post(':id/check-payment') @HttpCode(HttpStatus.OK) checkPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.orderService.checkPayment(user, id);
  }

  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query() query: OrderListQueryDto,
  ) {
    return this.orderService.listForUser(user.id, query);
  }

  @Get(':id') findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.orderService.findOneForUser(user.id, id);
  }
}
