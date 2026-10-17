import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import type { AuthenticatedRequest } from './jwt-auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Apenas administradores podem realizar esta operação.',
      );
    }

    return true;
  }
}
