import {
  BadRequestException,
  Controller,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { RatingsService } from './ratings.service.js';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyRating(@Req() request: AuthenticatedRequest) {
    return this.ratingsService.findOrCreateByUserId(request.user.id);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('country') country?: string,
    @Query('page') page?: string,
  ) {
    const normalizedCountry = country?.trim().toUpperCase();

    if (normalizedCountry && !/^[A-Z]{2}$/.test(normalizedCountry)) {
      throw new BadRequestException(
        'O país deve ser um código de duas letras.',
      );
    }

    const parsedPage = page === undefined ? 1 : Number(page);

    if (!Number.isSafeInteger(parsedPage) || parsedPage < 1) {
      throw new BadRequestException(
        'A página deve ser um número inteiro maior que zero.',
      );
    }

    return this.ratingsService.getLeaderboard(normalizedCountry, parsedPage);
  }
}
