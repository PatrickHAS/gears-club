import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service.js';
import { RatingsController } from './ratings.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [RatingsService],
  controllers: [RatingsController],
  exports: [RatingsService],
})
export class RatingsModule {}
