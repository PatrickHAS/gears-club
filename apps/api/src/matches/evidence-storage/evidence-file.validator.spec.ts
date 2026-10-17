import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import {
  MAX_EVIDENCE_FILE_SIZE,
  normalizeEvidenceImage,
  validateEvidenceFile,
} from './evidence-file.validator.js';

describe('validateEvidenceFile', () => {
  it('deve aceitar a assinatura de um arquivo PNG', () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    expect(validateEvidenceFile(buffer)).toBe('png');
  });

  it('deve aceitar a assinatura de um arquivo JPEG', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    expect(validateEvidenceFile(buffer)).toBe('jpg');
  });

  it('deve aceitar a assinatura de um arquivo WebP', () => {
    const buffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    expect(validateEvidenceFile(buffer)).toBe('webp');
  });

  it('deve rejeitar arquivos vazios', () => {
    expect(() => validateEvidenceFile(Buffer.alloc(0))).toThrow(
      BadRequestException,
    );
  });

  it('deve rejeitar arquivos maiores que 5 MB', () => {
    const buffer = Buffer.alloc(MAX_EVIDENCE_FILE_SIZE + 1);

    expect(() => validateEvidenceFile(buffer)).toThrow(BadRequestException);
  });

  it('deve rejeitar conteúdo desconhecido', () => {
    const buffer = Buffer.from('arquivo executavel falso');

    expect(() => validateEvidenceFile(buffer)).toThrow(BadRequestException);
  });

  it('deve rejeitar um arquivo PDF', () => {
    const buffer = Buffer.from('%PDF-1.7');

    expect(() => validateEvidenceFile(buffer)).toThrow(BadRequestException);
  });
});

describe('normalizeEvidenceImage', () => {
  it('deve normalizar uma imagem PNG válida', async () => {
    const original = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeEvidenceImage(original);
    const metadata = await sharp(normalized).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(600);
  });

  it('deve converter uma imagem JPEG válida para PNG', async () => {
    const original = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .toBuffer();

    const normalized = await normalizeEvidenceImage(original);
    const metadata = await sharp(normalized).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(480);
  });

  it('deve converter uma imagem WebP válida para PNG', async () => {
    const original = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: '#ffffff',
      },
    })
      .webp()
      .toBuffer();

    const normalized = await normalizeEvidenceImage(original);
    const metadata = await sharp(normalized).metadata();

    expect(metadata.format).toBe('png');
  });

  it('deve rejeitar um PNG com apenas a assinatura binária', async () => {
    const invalidPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    await expect(normalizeEvidenceImage(invalidPng)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve rejeitar imagens com largura superior a 4096 pixels', async () => {
    const original = await sharp({
      create: {
        width: 4097,
        height: 100,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();

    await expect(normalizeEvidenceImage(original)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve rejeitar imagens com altura superior a 4096 pixels', async () => {
    const original = await sharp({
      create: {
        width: 100,
        height: 4097,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();

    await expect(normalizeEvidenceImage(original)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve rejeitar arquivos vazios', async () => {
    await expect(normalizeEvidenceImage(Buffer.alloc(0))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve rejeitar PNG normalizado maior que 5 MB', async () => {
    const width = 2500;
    const height = 2500;

    // Gera pixels variados para dificultar a compressão PNG.
    const pixels = Buffer.alloc(width * height * 3);

    for (let index = 0; index < pixels.length; index++) {
      pixels[index] = (index * 37 + (index >> 8) * 13) % 256;
    }

    const original = await sharp(pixels, {
      raw: {
        width,
        height,
        channels: 3,
      },
    })
      .jpeg({ quality: 65 })
      .toBuffer();

    expect(original.length).toBeLessThanOrEqual(MAX_EVIDENCE_FILE_SIZE);

    await expect(normalizeEvidenceImage(original)).rejects.toThrow(
      'A imagem processada ultrapassa o limite de 5 MB.',
    );
  });
});
