import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';
import { EvidenceStorageService } from './evidence-storage/evidence-storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MatchesController],
  providers: [MatchesService, EvidenceStorageService],
  exports: [MatchesService],
})
export class MatchesModule {}
