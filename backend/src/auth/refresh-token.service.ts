import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private ttlMs() {
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7);
    return days * 24 * 60 * 60 * 1000;
  }
  async issue(userId: number) {
    const token = randomBytes(48).toString('base64url');
    const maxAgeMs = this.ttlMs();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + maxAgeMs),
      },
    });
    return { token, maxAgeMs };
  }
  findByToken(token: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
  }
  async revokeIfActive(id: number) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }
}
