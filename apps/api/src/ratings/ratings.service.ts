import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByUserId(userId: string) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil do jogador não encontrado.');
    }

    const rating = await this.prisma.playerRating.upsert({
      where: {
        playerProfileId: profile.id,
      },
      update: {},
      create: {
        playerProfileId: profile.id,
      },
      select: {
        id: true,
        elo: true,
        wins: true,
        losses: true,
        matches: true,
      },
    });

    const winRate =
      rating.matches === 0
        ? 0
        : Number(((rating.wins / rating.matches) * 100).toFixed(2));

    return {
      ...rating,
      winRate,
    };
  }

  async getLeaderboard(country?: string, page = 1) {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const where = {
      playerProfile: {
        gamertag: { not: null },
        country: country ? { equals: country } : { not: null },
      },
    };

    const [ratings, total] = await this.prisma.$transaction([
      this.prisma.playerRating.findMany({
        where,
        orderBy: [{ elo: 'desc' }, { wins: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
        select: {
          elo: true,
          wins: true,
          losses: true,
          matches: true,
          playerProfile: {
            select: {
              gamertag: true,
              country: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.playerRating.count({ where }),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      players: ratings.map((rating, index) => ({
        position: skip + index + 1,
        gamertag: rating.playerProfile.gamertag,
        country: rating.playerProfile.country,
        avatarUrl: rating.playerProfile.avatarUrl,
        elo: rating.elo,
        wins: rating.wins,
        losses: rating.losses,
        matches: rating.matches,
        winRate:
          rating.matches === 0
            ? 0
            : Number(((rating.wins / rating.matches) * 100).toFixed(2)),
      })),
    };
  }
}
