import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { AdminGuard } from './admin.guard.js';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  const createContext = (user?: { role: UserRole }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('deve permitir acesso ao administrador', () => {
    const context = createContext({
      role: UserRole.ADMIN,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve bloquear jogadores comuns com 403', () => {
    const context = createContext({
      role: UserRole.USER,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('deve rejeitar requisições sem usuário autenticado', () => {
    const context = createContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
