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
import { BrandService } from './brand.service';

@ApiTags('admin-brands')
@ApiBearerAuth()
@Controller('admin/brands')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post() create(@Body() dto: NameDto) {
    return this.brandService.create(dto.name);
  }

  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NameDto,
  ) {
    return this.brandService.update(id, dto.name);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) async remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.brandService.remove(id);
  }
}
