import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminBrandController } from './admin-brand.controller';
import { AdminCategoryController } from './admin-category.controller';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [PrismaModule, PassportModule.register({})],
  controllers: [
    CategoryController,
    AdminCategoryController,
    BrandController,
    AdminBrandController,
  ],
  providers: [CategoryService, BrandService],
})
export class ProductModule {}
