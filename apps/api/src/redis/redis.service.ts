import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private readonly client: RedisClientType = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  });

  constructor() {
    this.client.on('error', (error: Error) => {
      this.logger.error(`Erro na conexão Redis: ${error.message}`);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis conectado e pronto para uso.');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
