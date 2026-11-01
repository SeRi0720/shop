import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { readRedisConfig } from '../redis/redis.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        // Mỗi instance giữ tối đa N kết nối; N x số instance phải < max_connections của Postgres (50).
        max: readRedisConfig(process.env).databasePoolMax,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
