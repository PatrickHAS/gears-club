import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;

  const queryRawMock = vi.fn();

  beforeEach(async () => {
    queryRawMock.mockReset();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: queryRawMock,
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('deve retornar "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health/database', () => {
    it('deve retornar sucesso quando o banco responder', async () => {
      queryRawMock.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.checkDatabase();

      expect(result).toEqual({
        status: 'ok',
        database: 'connected',
      });

      expect(queryRawMock).toHaveBeenCalledOnce();
    });

    it('deve propagar erro quando o banco estiver indisponível', async () => {
      queryRawMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(appController.checkDatabase()).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});
