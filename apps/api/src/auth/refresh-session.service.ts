import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(48).toString('hex');
  }

  async create(userId: string) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async rotate(token: string) {
    const now = new Date();
    const newToken = this.generateToken();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.refreshSession.updateMany({
        where: {
          tokenHash: this.hashToken(token),
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
        },
      });

      if (result.count !== 1) {
        throw new UnauthorizedException('Sessão inválida ou expirada.');
      }

      const previousSession = await tx.refreshSession.findUniqueOrThrow({
        where: {
          tokenHash: this.hashToken(token),
        },
      });

      const session = await tx.refreshSession.create({
        data: {
          userId: previousSession.userId,
          tokenHash: this.hashToken(newToken),
          expiresAt,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      return {
        token: newToken,
        expiresAt,
        user: session.user,
      };
    });
  }

  async revoke(token: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
