import { ConflictException, NotFoundException } from '@nestjs/common';

export function toHttpException(error: unknown, label: string): unknown {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'P2002') return new ConflictException(`${label} đã tồn tại`);
  if (code === 'P2003')
    return new ConflictException(`${label} còn sản phẩm, không thể xóa`);
  if (code === 'P2025')
    return new NotFoundException(`Không tìm thấy ${label.toLowerCase()}`);
  return error;
}
