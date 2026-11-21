import { Module } from '@nestjs/common';
import { CACHE_STORE, COUNTER_STORE } from './cache.types';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

@Module({
  providers: [
    RedisService,
    CacheService,
    { provide: CACHE_STORE, useExisting: RedisService },
    { provide: COUNTER_STORE, useExisting: RedisService },
  ],
  exports: [RedisService, CacheService, COUNTER_STORE],
})
export class RedisModule {}
