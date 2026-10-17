import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshSessionService } from './refresh-session.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshSessions: RefreshSessionService,
  ) {}

  private async generateAccessToken(userId: string) {
    return this.jwtService.signAsync({
      sub: userId,
    });
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);

    if (!validPassword) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const session = await this.refreshSessions.create(user.id);
    const accessToken = await this.generateAccessToken(user.id);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: session.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(token: string) {
    const session = await this.refreshSessions.rotate(token);
    const accessToken = await this.generateAccessToken(session.user.id);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: session.token,
      user: session.user,
    };
  }

  async logout(token: string) {
    await this.refreshSessions.revoke(token);
  }
}
