import { afterEach, describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { EvidenceStorageService } from './evidence-storage.service.js';

describe('EvidenceStorageService', () => {
  const service = new EvidenceStorageService();
  const createdKeys: string[] = [];

  afterEach(async () => {
    for (const key of createdKeys.splice(0)) {
      await service.remove(key);
    }
  });

  async function createImage(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('deve salvar uma imagem com chave UUID e extensão PNG', async () => {
    const image = await createImage();

    const imageKey = await service.save(image);
    createdKeys.push(imageKey);

    expect(imageKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i,
    );
  });

  it('deve recuperar a imagem normalizada', async () => {
    const imageKey = await service.save(await createImage());
    createdKeys.push(imageKey);

    const storedImage = await service.read(imageKey);
    const metadata = await sharp(storedImage).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(600);
  });

  it('deve gerar chaves diferentes para arquivos diferentes', async () => {
    const image = await createImage();

    const firstKey = await service.save(image);
    const secondKey = await service.save(image);

    createdKeys.push(firstKey, secondKey);

    expect(firstKey).not.toBe(secondKey);
  });

  it('deve excluir uma imagem armazenada', async () => {
    const imageKey = await service.save(await createImage());

    await service.remove(imageKey);

    await expect(service.read(imageKey)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('deve rejeitar chaves com tentativa de atravessar diretórios', async () => {
    await expect(service.read('../../arquivo.png')).rejects.toThrow(
      'Chave de imagem inválida.',
    );
  });

  it('deve rejeitar arquivos corrompidos antes de salvar', async () => {
    const invalidImage = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    await expect(service.save(invalidImage)).rejects.toThrow(
      BadRequestException,
    );
  });
});
