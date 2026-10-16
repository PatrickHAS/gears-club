import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { UpdateMatchmakingPreferencesDto } from './dto/update-matchmaking-preferences.dto.js';

@Injectable()
export class MatchmakingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        country: true,
        matchmakingRegions: {
          select: {
            country: true,
          },
          orderBy: {
            country: 'asc',
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de jogador não encontrado.');
    }

    const selectedCountries = profile.matchmakingRegions.map(
      (region) => region.country,
    );

    const acceptedCountries = [
      ...new Set(
        [profile.country, ...selectedCountries].filter(
          (country): country is string => country !== null,
        ),
      ),
    ].sort();

    return {
      profileCountry: profile.country,
      selectedCountries,
      acceptedCountries,
    };
  }

  async updatePreferences(
    userId: string,
    dto: UpdateMatchmakingPreferencesDto,
  ) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de jogador não encontrado.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.playerMatchmakingRegion.deleteMany({
        where: {
          playerProfileId: profile.id,
        },
      });

      if (dto.countries.length > 0) {
        await tx.playerMatchmakingRegion.createMany({
          data: dto.countries.map((country) => ({
            playerProfileId: profile.id,
            country,
          })),
        });
      }
    });

    return this.getPreferences(userId);
  }
}
