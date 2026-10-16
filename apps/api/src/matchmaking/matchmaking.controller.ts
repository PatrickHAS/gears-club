import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';

import { MatchmakingService } from './matchmaking.service.js';

import { UpdateMatchmakingPreferencesDto } from './dto/update-matchmaking-preferences.dto.js';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Get('preferences')
  async getPreferences(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.getPreferences(request.user.id);
  }

  @Put('preferences')
  async updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMatchmakingPreferencesDto,
  ) {
    return this.matchmakingService.updatePreferences(request.user.id, dto);
  }
}
