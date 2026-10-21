import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

/** Mô hình đọc cho thống kê: chỉ SELECT, không ghi (ngoại lệ có chủ đích của quy tắc module, mục 5). */
@Module({
  imports: [PrismaModule, UserModule, PassportModule.register({})],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
