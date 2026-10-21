import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

/** Mô hình đọc cho thống kê: chỉ SELECT, không ghi (ngoại lệ có chủ đích của quy tắc module, xem mục 5). */
@Module({ imports: [PrismaModule] })
export class StatsModule {}
