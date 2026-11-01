import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { readTrustProxy } from './common/trust-proxy';
import { UPLOAD_URL_PREFIX, getUploadDir } from './product/upload.config';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import { RedisService } from './redis/redis.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  // Số hop proxy tin cậy (Nginx = 1). Không dùng `true`: client tự giả được X-Forwarded-For.
  app.set('trust proxy', readTrustProxy(process.env));

  // Adapter Redis cho Socket.IO: phải đăng ký trước app.listen. Redis chết thì không sập (fail-open).
  const redis = app.get(RedisService);
  if (redis.cfg.enabled) {
    app.useWebSocketAdapter(new RedisIoAdapter(app, redis));
    console.log('[socket.io] adapter Redis: bật');
  } else {
    console.log('[socket.io] adapter Redis: tắt (chỉ phát trong instance này)');
  }

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Phục vụ ảnh upload. Global prefix 'api' KHÔNG tự áp dụng cho file tĩnh,
  // nên prefix phải viết tường minh: /api/uploads/<tên-file>
  const uploadDir = getUploadDir();
  console.log('[uploads] dir =', uploadDir);
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, {
    prefix: UPLOAD_URL_PREFIX,
    maxAge: '7d', // tên file là UUID nên nội dung không bao giờ đổi
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  const config = new DocumentBuilder()
    .setTitle('Shop API')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Khởi động thất bại:', err);
  process.exit(1);
});
