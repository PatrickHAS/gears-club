import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Token não informado.');
    }

    const [type, token, ...extra] = authorization.split(' ');

    if (type !== 'Bearer' || !token || extra.length > 0) {
      throw new UnauthorizedException('Token inválido.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token);

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Token inválido.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado.');
      }

      request.user = user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
