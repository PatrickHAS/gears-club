import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeEvidenceImage } from './evidence-file.validator.js';

@Injectable()
export class EvidenceStorageService {
  private readonly storageDirectory = join(
    process.cwd(),
    'storage',
    'dispute-evidences',
  );

  async save(file: Buffer): Promise<string> {
    const normalized = await normalizeEvidenceImage(file);

    await mkdir(this.storageDirectory, { recursive: true });

    const imageKey = `${randomUUID()}.png`;

    await writeFile(join(this.storageDirectory, imageKey), normalized, {
      flag: 'wx',
    });

    return imageKey;
  }

  async read(imageKey: string): Promise<Buffer> {
    this.validateImageKey(imageKey);

    return readFile(join(this.storageDirectory, imageKey));
  }

  async remove(imageKey: string): Promise<void> {
    this.validateImageKey(imageKey);

    await unlink(join(this.storageDirectory, imageKey));
  }

  private validateImageKey(imageKey: string): void {
    const pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;

    if (!pattern.test(imageKey)) {
      throw new Error('Chave de imagem inválida.');
    }
  }
}
