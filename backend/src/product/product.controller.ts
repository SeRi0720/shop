import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductService } from './product.service';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get() search(@Query() query: ProductQueryDto) {
    return this.productService.search(query, false);
  }

  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id, false);
  }
}
