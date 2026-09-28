import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';

@Module({
  imports: [PassportModule.register({})],
  controllers: [AdminController],
})
export class AdminModule {}
