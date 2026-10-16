import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PlayersModule } from './players/players.module.js';
import { RatingsModule } from './ratings/ratings.module.js';
import { MatchmakingModule } from './matchmaking/matchmaking.module.js';
import { RedisModule } from './redis/redis.module.js';
import { MatchesModule } from './matches/matches.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    PlayersModule,
    RatingsModule,
    MatchmakingModule,
    RedisModule,
    MatchesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
