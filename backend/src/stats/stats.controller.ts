import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import {
  RevenueQueryDto,
  StatsRangeQueryDto,
  TopProductsQueryDto,
} from './dto/stats-query.dto';
import { resolveRange } from './stats-range';
import { StatsService } from './stats.service';

@ApiTags('admin-stats')
@ApiBearerAuth()
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('summary') summary(@Query() q: StatsRangeQueryDto) {
    return this.stats.summary(resolveRange(q));
  }
  @Get('revenue') revenue(@Query() q: RevenueQueryDto) {
    return this.stats.revenue(resolveRange(q));
  }
  @Get('top-products') topProducts(@Query() q: TopProductsQueryDto) {
    return this.stats.topProducts(resolveRange(q), q.limit ?? 5);
  }
  @Get('order-status') orderStatus(@Query() q: StatsRangeQueryDto) {
    return this.stats.orderStatus(resolveRange(q));
  }
}
