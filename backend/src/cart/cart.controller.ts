import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get() get(@CurrentUser() user: AuthUser) {
    return this.cartService.getCart(user.id);
  }

  @Post('items') add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch('items/:productId') update(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseIdPipe) productId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.setQuantity(user.id, productId, dto.quantity);
  }

  @Delete('items/:productId') remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseIdPipe) productId: number,
  ) {
    return this.cartService.removeItem(user.id, productId);
  }
}
