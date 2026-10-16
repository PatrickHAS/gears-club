import { BadRequestException, Injectable } from '@nestjs/common';
import { MatchTeam } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateMatchInput {
  playerProfileIds: string[];
  region: string;
}

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMatch(input: CreateMatchInput) {
    const { playerProfileIds, region } = input;

    // Uma partida de Demolição precisa de 8 jogadores.
    if (playerProfileIds.length !== 8) {
      throw new BadRequestException(
        'Uma partida 4v4 precisa de exatamente 8 jogadores.',
      );
    }

    // Impede jogadores duplicados na mesma partida.
    if (new Set(playerProfileIds).size !== 8) {
      throw new BadRequestException(
        'Uma partida não pode conter jogadores duplicados.',
      );
    }

    // A região deve ser um código de país de 2 letras.
    if (!/^[A-Z]{2}$/.test(region)) {
      throw new BadRequestException('A região da partida é inválida.');
    }

    // Confirma que todos os perfis existem.
    const profiles = await this.prisma.playerProfile.findMany({
      where: {
        id: {
          in: playerProfileIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (profiles.length !== 8) {
      throw new BadRequestException(
        'Um ou mais jogadores não possuem perfil válido.',
      );
    }

    // Cria a partida e os 8 participantes em uma operação.
    return this.prisma.match.create({
      data: {
        mode: 'DEMOLITION',
        region,
        participants: {
          create: playerProfileIds.map((playerProfileId, index) => ({
            playerProfileId,
            team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
          })),
        },
      },
      include: {
        participants: true,
      },
    });
  }
}
