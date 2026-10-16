import { Module } from '@nestjs/common';
import { MatchmakingOrchestratorService } from './matchmaking-orchestrator.service.js';

import { AuthModule } from '../auth/auth.module.js';
import { MatchesModule } from '../matches/matches.module.js';

import { MatchmakingController } from './matchmaking.controller.js';
import { MatchmakingService } from './matchmaking.service.js';
import { MatchmakingQueueService } from './matchmaking-queue/matchmaking-queue.service.js';

@Module({
  imports: [AuthModule, MatchesModule],
  controllers: [MatchmakingController],
  providers: [
    MatchmakingService,
    MatchmakingQueueService,
    MatchmakingOrchestratorService,
  ],
})
export class MatchmakingModule {}
