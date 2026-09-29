import { Injectable } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/** Where uploaded media lives on disk; served publicly under /media (see main.ts). */
export const mediaRoot = () => resolve(process.env.MEDIA_DIR ?? 'uploads');

/**
 * File storage for product photos. A local folder for now; the interface (save by key,
 * delete by key, public URL) is what an S3-compatible bucket would need too.
 */
@Injectable()
export class MediaStorage {
  async save(key: string, data: Buffer) {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async remove(key: string) {
    await rm(this.pathOf(key), { force: true });
  }

  /** Keys come from our own ids, but a key must never point outside the media folder. */
  private pathOf(key: string) {
    const root = mediaRoot();
    const path = resolve(join(root, key));
    if (!path.startsWith(root + sep))
      throw new Error(`Media key escapes storage: ${key}`);
    return path;
  }
}
