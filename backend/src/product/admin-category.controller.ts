import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { NameDto } from './dto/name.dto';
import { CategoryService } from './category.service';

@ApiTags('admin-categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post() create(@Body() dto: NameDto) {
    return this.categoryService.create(dto.name);
  }

  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NameDto,
  ) {
    return this.categoryService.update(id, dto.name);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) async remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.categoryService.remove(id);
  }
}
