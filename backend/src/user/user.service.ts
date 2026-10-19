import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}

export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
}
