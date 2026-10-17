import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024;

export type EvidenceExtension = 'png' | 'jpg' | 'webp';

export function validateEvidenceFile(buffer: Buffer): EvidenceExtension {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0 ||
    buffer.length > MAX_EVIDENCE_FILE_SIZE
  ) {
    throw new BadRequestException('A imagem deve ter entre 1 byte e 5 MB.');
  }

  // Assinatura PNG
  const isPng =
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  if (isPng) {
    return 'png';
  }

  // Assinatura JPEG
  const isJpeg =
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff &&
    buffer[3] !== 0x00;

  if (isJpeg) {
    return 'jpg';
  }

  // Assinatura WebP
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  if (isWebp) {
    return 'webp';
  }

  throw new BadRequestException(
    'Formato inválido. Envie uma imagem PNG, JPEG ou WebP.',
  );
}

export async function normalizeEvidenceImage(buffer: Buffer): Promise<Buffer> {
  // Verifica o tamanho e a assinatura antes da decodificação.
  validateEvidenceFile(buffer);

  try {
    const image = sharp(buffer, {
      failOn: 'error',
      limitInputPixels: 16_000_000,
      animated: false,
    });

    const metadata = await image.metadata();

    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096
    ) {
      throw new BadRequestException(
        'A imagem deve ter dimensões de até 4096 × 4096 pixels.',
      );
    }

    // Recria a imagem, descartando metadados e
    // preservando os detalhes necessários para análise.

    const normalized = await image.rotate().png().toBuffer();

    if (normalized.length > MAX_EVIDENCE_FILE_SIZE) {
      throw new BadRequestException(
        'A imagem processada ultrapassa o limite de 5 MB.',
      );
    }

    return normalized;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(
      'A imagem está corrompida ou não pode ser processada.',
    );
  }
}
