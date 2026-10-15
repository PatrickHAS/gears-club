import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from './guards/jwt-auth.guard.js';

const COOKIE_NAME = 'gears_club_refresh';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/auth',
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    const { refreshToken, ...publicResult } = result;

    response.cookie(COOKIE_NAME, refreshToken, {
      ...getCookieOptions(),
      maxAge: COOKIE_MAX_AGE,
    });

    return publicResult;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[COOKIE_NAME];

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    const result = await this.authService.refresh(token);
    const { refreshToken, ...publicResult } = result;

    response.cookie(COOKIE_NAME, refreshToken, {
      ...getCookieOptions(),
      maxAge: COOKIE_MAX_AGE,
    });

    return publicResult;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[COOKIE_NAME];

    if (typeof token === 'string' && token) {
      await this.authService.logout(token);
    }

    response.clearCookie(COOKIE_NAME, getCookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
