import { Module } from '@nestjs/common';
import { MatchmakingController } from './matchmaking.controller.js';
import { MatchmakingService } from './matchmaking.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
})
export class MatchmakingModule {}
