import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { UPLOAD_URL_PREFIX, getUploadDir } from './product/upload.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
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
