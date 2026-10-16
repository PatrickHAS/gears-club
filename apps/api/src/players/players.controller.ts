import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';

import { PlayersService } from './players.service.js';

import { UpdatePlayerProfileDto } from './dto/update-player-profile.dto.js';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get('me')
  async getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.playersService.findOrCreateByUserId(request.user.id);
  }

  @Patch('me')
  async updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePlayerProfileDto,
  ) {
    return this.playersService.updateMyProfile(request.user.id, dto);
  }
}
