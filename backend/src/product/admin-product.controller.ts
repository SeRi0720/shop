import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductService } from './product.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ProductImageService } from './product-image.service';
import {
  MAX_FILES_PER_REQUEST,
  imageUploadOptions,
  type UploadedImage,
} from './upload.config';

@ApiTags('admin-products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly imageService: ProductImageService,
  ) {}

  @Get() findAll(@Query() query: ProductQueryDto) {
    return this.productService.search(query, true);
  }

  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id, true);
  }

  @Post() create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, imageUploadOptions),
  )
  addImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: UploadedImage[] | undefined,
  ) {
    return this.imageService.addImages(id, files ?? []);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    await this.imageService.removeImage(id, imageId);
  }
}
