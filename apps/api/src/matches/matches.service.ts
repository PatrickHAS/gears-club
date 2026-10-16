import { BadRequestException, Injectable } from '@nestjs/common';
import { MatchTeam, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateMatchInput {
  playerProfileIds: string[];
  region: string;
  reservationId: string;
}

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMatch(input: CreateMatchInput) {
    const { playerProfileIds, region, reservationId } = input;

    if (playerProfileIds.length !== 8) {
      throw new BadRequestException(
        'Uma partida 4v4 precisa de exatamente 8 jogadores.',
      );
    }

    if (new Set(playerProfileIds).size !== 8) {
      throw new BadRequestException(
        'Uma partida não pode conter jogadores duplicados.',
      );
    }

    if (!/^[A-Z]{2}$/.test(region)) {
      throw new BadRequestException('A região da partida é inválida.');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(reservationId)) {
      throw new BadRequestException('O identificador da reserva é inválido.');
    }

    const existingMatch = await this.prisma.match.findUnique({
      where: { reservationId },
      include: { participants: true },
    });

    if (existingMatch) {
      this.validateExistingMatch(existingMatch, playerProfileIds, region);

      return existingMatch;
    }

    const profiles = await this.prisma.playerProfile.findMany({
      where: {
        id: { in: playerProfileIds },
      },
      select: { id: true },
    });

    if (profiles.length !== 8) {
      throw new BadRequestException(
        'Um ou mais jogadores não possuem perfil válido.',
      );
    }

    try {
      return await this.prisma.match.create({
        data: {
          reservationId,
          mode: 'DEMOLITION',
          region,
          participants: {
            create: playerProfileIds.map((playerProfileId, index) => ({
              playerProfileId,
              team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
            })),
          },
        },
        include: { participants: true },
      });
    } catch (error) {
      // Outra requisição pode ter criado a mesma reserva.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const match = await this.prisma.match.findUnique({
          where: { reservationId },
          include: { participants: true },
        });

        if (match) {
          this.validateExistingMatch(match, playerProfileIds, region);

          return match;
        }
      }

      throw error;
    }
  }

  private validateExistingMatch(
    match: {
      region: string;
      participants: {
        playerProfileId: string;
        team: MatchTeam;
      }[];
    },
    playerProfileIds: string[],
    region: string,
  ): void {
    if (match.region !== region) {
      throw new BadRequestException(
        'Esta reserva já pertence a uma partida de outra região.',
      );
    }

    const existingPlayerIds = new Set(
      match.participants.map((participant) => participant.playerProfileId),
    );

    const samePlayers =
      existingPlayerIds.size === 8 &&
      playerProfileIds.length === 8 &&
      playerProfileIds.every((id) => existingPlayerIds.has(id));

    if (!samePlayers) {
      throw new BadRequestException(
        'Esta reserva já pertence a uma partida com jogadores diferentes.',
      );
    }

    const cogCount = match.participants.filter(
      (participant) => participant.team === MatchTeam.COG,
    ).length;

    const locustCount = match.participants.filter(
      (participant) => participant.team === MatchTeam.LOCUST,
    ).length;

    if (cogCount !== 4 || locustCount !== 4) {
      throw new BadRequestException(
        'A partida existente possui equipes inválidas.',
      );
    }
  }
}
