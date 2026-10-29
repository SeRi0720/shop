import { Module } from '@nestjs/common';
import { CACHE_STORE } from './cache.types';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

@Module({
  providers: [
    RedisService,
    CacheService,
    { provide: CACHE_STORE, useExisting: RedisService },
  ],
  exports: [RedisService, CacheService],
})
export class RedisModule {}
