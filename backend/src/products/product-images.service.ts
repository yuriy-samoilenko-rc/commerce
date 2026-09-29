import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Sharp from 'sharp';
import { badRequest } from '../common/errors';
import { MediaStorage } from '../media/media-storage.service';
import { PrismaService } from '../prisma/prisma.service';

// sharp runs as CommonJS (module.exports = sharp) but its default type entry is the ESM
// one (export default); without esModuleInterop, require() is how to get the function.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof Sharp = require('sharp');

export const MAX_IMAGES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Stored renditions: the product page and zoom, and lists/thumbnails. */
const SIZES = { large: 1200, thumb: 400 } as const;
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);

export const imageSelect = {
  id: true,
  fileKey: true,
  width: true,
  height: true,
  alt: true,
  position: true,
} as const;

type ImageRow = {
  id: string;
  fileKey: string;
  width: number;
  height: number;
  alt: string | null;
  position: number;
};

/** What clients get: two ready-made WebP sizes, no storage keys. */
export function presentImage({ fileKey, ...image }: ImageRow) {
  return {
    ...image,
    url: `/media/${fileKey}-${SIZES.large}.webp`,
    thumbUrl: `/media/${fileKey}-${SIZES.thumb}.webp`,
  };
}

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  list(productId: string) {
    return this.prisma.productImage
      .findMany({
        where: { productId },
        select: imageSelect,
        orderBy: { position: 'asc' },
      })
      .then((rows) => rows.map(presentImage));
  }

  /**
   * Stores uploaded photos as WebP (EXIF rotation applied, metadata stripped) and
   * appends them after the existing ones. The first photo of a product is its main one.
   */
  async upload(
    productId: string,
    files: { buffer: Buffer; originalname: string }[],
  ) {
    await this.assertProduct(productId);
    if (!files?.length) throw badRequest('NO_FILES', 'No files were uploaded');
    const existing = await this.prisma.productImage.count({
      where: { productId },
    });
    if (existing + files.length > MAX_IMAGES) {
      throw badRequest(
        'TOO_MANY_IMAGES',
        `A product can have at most ${MAX_IMAGES} photos`,
        {
          max: MAX_IMAGES,
          left: Math.max(0, MAX_IMAGES - existing),
        },
      );
    }

    // Decode everything first: one bad file rejects the batch before anything is written.
    const decoded = await Promise.all(
      files.map(async (f) => {
        const meta = await sharp(f.buffer)
          .metadata()
          .catch(() => null);
        if (!meta?.format || !ACCEPTED.has(meta.format)) {
          throw badRequest(
            'IMAGE_FORMAT',
            `${f.originalname} is not a JPEG, PNG or WebP image`,
            {
              file: f.originalname,
            },
          );
        }
        return f.buffer;
      }),
    );

    let position = existing;
    for (const buffer of decoded) {
      const id = randomUUID();
      const fileKey = `products/${productId}/${id}`;
      const base = sharp(buffer).rotate();
      const large = await base
        .clone()
        .resize({
          width: SIZES.large,
          height: SIZES.large,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      const thumb = await base
        .clone()
        .resize({
          width: SIZES.thumb,
          height: SIZES.thumb,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toBuffer();
      await this.storage.save(`${fileKey}-${SIZES.large}.webp`, large.data);
      await this.storage.save(`${fileKey}-${SIZES.thumb}.webp`, thumb);
      await this.prisma.productImage.create({
        data: {
          id,
          productId,
          fileKey,
          width: large.info.width,
          height: large.info.height,
          position: position++,
        },
      });
    }
    return this.list(productId);
  }

  async update(productId: string, imageId: string, alt: string | null) {
    const { count } = await this.prisma.productImage.updateMany({
      where: { id: imageId, productId },
      data: { alt: alt?.trim() || null },
    });
    if (!count) throw new NotFoundException('Image not found');
    return this.list(productId);
  }

  /** New order of all the product's photos; the first becomes the main photo. */
  async reorder(productId: string, ids: string[]) {
    const current = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    const known = new Set(current.map((i) => i.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      throw badRequest(
        'IMAGE_ORDER',
        'The order must list every photo of the product exactly once',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.productImage.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list(productId);
  }

  async remove(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
      select: { fileKey: true },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      // Close the gap so positions stay 0..n-1 and the next photo becomes the main one.
      const rest = await tx.productImage.findMany({
        where: { productId },
        select: { id: true },
        orderBy: { position: 'asc' },
      });
      for (const [position, { id }] of rest.entries()) {
        await tx.productImage.update({ where: { id }, data: { position } });
      }
    });
    // Files go after the row: a failed delete leaves an orphan file, never a broken image.
    for (const size of Object.values(SIZES)) {
      await this.storage.remove(`${image.fileKey}-${size}.webp`);
    }
    return this.list(productId);
  }

  private async assertProduct(id: string) {
    const found = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Product not found');
  }
}
