import { Module } from '@nestjs/common';
import { PlayersService } from './players.service.js';
import { PlayersController } from './players.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  providers: [PlayersService],
  controllers: [PlayersController],
  imports: [AuthModule],
})
export class PlayersModule {}
