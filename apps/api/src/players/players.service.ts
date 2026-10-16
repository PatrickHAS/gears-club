import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

import { UpdatePlayerProfileDto } from './dto/update-player-profile.dto.js';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.prisma.playerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: {
        id: true,
        gamertag: true,
        country: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateMyProfile(userId: string, dto: UpdatePlayerProfileDto) {
    await this.findOrCreateByUserId(userId);

    const gamertag = dto.gamertag?.trim();

    try {
      return await this.prisma.playerProfile.update({
        where: { userId },
        data: {
          ...(gamertag !== undefined && { gamertag }),
          ...(dto.country !== undefined && {
            country: dto.country,
          }),
          ...(dto.avatarUrl !== undefined && {
            avatarUrl: dto.avatarUrl,
          }),
        },
        select: {
          id: true,
          gamertag: true,
          country: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Esta gamertag já está cadastrada.');
      }

      throw error;
    }
  }
}
