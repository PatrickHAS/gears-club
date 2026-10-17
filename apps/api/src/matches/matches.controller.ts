import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';

import { MatchesService } from './matches.service.js';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get(':id')
  async getMatchById(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.matchesService.getMatchById(matchId, request.user.id);
  }
}
