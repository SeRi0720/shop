import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { AdminUserItemDto } from './dto/admin-user-response.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { escapeLike } from '../common/escape-like';

const adminUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

const profileSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
} as const satisfies Prisma.UserSelect;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }
  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
  }) {
    return this.prisma.user.create({
      data: { ...data, email: data.email.trim().toLowerCase() },
    });
  }

  async findSummariesByIds(ids: number[]): Promise<Map<number, UserSummary>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, email: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Cho JwtStrategy: chỉ lấy đúng 3 cột, truy vấn theo khóa chính. */
  findAuthState(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
  }

  async listForAdmin(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim();
    const like = q
      ? ({ contains: escapeLike(q), mode: 'insensitive' } as const)
      : undefined;

    const where: Prisma.UserWhereInput = {
      isActive:
        query.status === 'active'
          ? true
          : query.status === 'locked'
            ? false
            : undefined,
      OR: like
        ? [{ email: like }, { fullName: like }, { phone: like }]
        : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: adminUserSelect,
      }),
    ]);
    return {
      items: rows.map((r) => AdminUserItemDto.from(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async setActive(id: number, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: adminUserSelect,
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.role === 'ADMIN') {
      throw new ConflictException('Không thể khóa tài khoản quản trị');
    }
    if (user.isActive === isActive) return AdminUserItemDto.from(user); // idempotent
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: adminUserSelect,
    });
    return AdminUserItemDto.from(updated);
  }

  /** Người dùng tự sửa hồ sơ: chỉ họ tên và số điện thoại. undefined = giữ nguyên, phone null = xóa. */
  updateProfile(
    id: number,
    data: { fullName?: string; phone?: string | null },
  ) {
    if (data.fullName === undefined && data.phone === undefined) {
      return this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: profileSelect,
      }); // không có gì để đổi thì không ghi DB
    }
    return this.prisma.user.update({
      where: { id },
      data: { fullName: data.fullName, phone: data.phone },
      select: profileSelect,
    });
  }

  /** Người dùng mới (chỉ USER) trong khoảng [from, to]; dùng cho thống kê ngày 3. */
  countNewUsers(from: Date, to: Date) {
    return this.prisma.user.count({
      where: { role: 'USER', createdAt: { gte: from, lte: to } },
    });
  }
}

export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
}
