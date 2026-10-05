import { BadRequestException } from '@nestjs/common';
import { resolve } from 'node:path';

export const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 5;
export const MAX_IMAGES_PER_PRODUCT = 8;
export const UPLOAD_URL_PREFIX = '/api/uploads';

type FileFilterCb = (error: Error | null, acceptFile: boolean) => void;

// Gọi lúc dùng (không đọc ở top-level) để chắc chắn .env đã được nạp.
export const getUploadDir = () =>
  resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');

// Chỉ khai báo phần cần dùng của Express.Multer.File, tránh phụ thuộc kiểu toàn cục
// (tsconfig có "types": ["node","jest"] nên không tự nạp @types/multer).
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export function imageFileFilter(
  _req: unknown,
  file: { mimetype: string },
  cb: FileFilterCb,
) {
  if (!(file.mimetype in IMAGE_EXT)) {
    return cb(new BadRequestException('Chỉ nhận ảnh jpeg, png, webp'), false);
  }
  cb(null, true);
}

export const imageUploadOptions = {
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
  fileFilter: imageFileFilter,
};
