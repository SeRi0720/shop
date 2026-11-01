import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import type { RedisService } from './redis.service';

/** Chuyển lệnh phát (to(room).emit) qua pub/sub Redis để mọi instance cùng phát cho socket của mình. */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext, redis: RedisService) {
    super(app);
    const { pub, sub } = redis.createPubSubPair();
    this.adapterConstructor = createAdapter(pub, sub);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
