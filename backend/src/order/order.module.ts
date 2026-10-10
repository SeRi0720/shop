import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CartModule } from '../cart/cart.module';
import { PaymentModule } from '../payment/payment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({}),
    CartModule,
    ProductModule,
    PaymentModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
