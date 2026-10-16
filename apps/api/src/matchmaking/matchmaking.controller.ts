import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { MatchmakingService } from './matchmaking.service.js';
import { MatchmakingQueueService } from './matchmaking-queue/matchmaking-queue.service.js';
import { UpdateMatchmakingPreferencesDto } from './dto/update-matchmaking-preferences.dto.js';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly matchmakingQueueService: MatchmakingQueueService,
  ) {}

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

  @Post('queue')
  async joinQueue(@Req() request: AuthenticatedRequest) {
    return this.matchmakingQueueService.join(request.user.id);
  }

  @Get('queue')
  async getQueueStatus(@Req() request: AuthenticatedRequest) {
    const entry = await this.matchmakingQueueService.getStatus(request.user.id);

    return {
      inQueue: entry !== null,
      entry,
    };
  }

  @Patch('queue/heartbeat')
  async heartbeatQueue(@Req() request: AuthenticatedRequest) {
    return this.matchmakingQueueService.heartbeat(request.user.id);
  }

  @Delete('queue')
  async leaveQueue(@Req() request: AuthenticatedRequest) {
    return this.matchmakingQueueService.leave(request.user.id);
  }
}
