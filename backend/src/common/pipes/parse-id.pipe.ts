import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';

const MAX_INT = 2_147_483_647;

@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^\d+$/.test(value)) throw new BadRequestException('id không hợp lệ');
    const id = Number(value);
    if (id < 1 || id > MAX_INT) throw new NotFoundException('Không tìm thấy');
    return id;
  }
}
