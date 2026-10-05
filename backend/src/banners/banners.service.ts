import { Injectable, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { randomUUID } from 'node:crypto';
import type Sharp from 'sharp';
import { AuditService, changedKeys } from '../audit/audit.service';
import { badRequest } from '../common/errors';
import { BannerTheme } from '../generated/prisma/client';
import { MediaStorage } from '../media/media-storage.service';
import { PrismaService } from '../prisma/prisma.service';

// See product-images.service.ts: sharp is CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof Sharp = require('sharp');

export const MAX_BANNER_BYTES = 10 * 1024 * 1024;
/** One rendition: the picture fills the whole slider, so wide enough for sharp large screens. */
const IMAGE_WIDTH = 1920;
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);

export class CreateBannerDto {
  @IsString() @MinLength(1) @MaxLength(80) title: string;
  @IsOptional() @IsString() @MaxLength(200) text?: string | null;
  @IsOptional() @IsString() @MaxLength(30) badge?: string | null;
  @IsOptional() @IsString() @MaxLength(40) buttonText?: string | null;

  /** A shop path or a full https:// address. */
  @IsString()
  @MaxLength(300)
  @Matches(/^(\/(?!\/)\S*|https:\/\/\S+)$/)
  link: string;

  @IsOptional() @IsEnum(BannerTheme) theme?: BannerTheme;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date | null;
}

export class ReorderBannersDto {
  @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) ids: string[];
}

type BannerRow = { imageKey: string | null };

/** What clients get: the picture's URL, never the storage key. */
function present<T extends BannerRow>({ imageKey, ...b }: T) {
  return { ...b, imageUrl: imageKey ? `/media/${imageKey}.webp` : null };
}

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: MediaStorage,
  ) {}

  /** Banners on the shop home page right now, in slider order. */
  async live() {
    const now = new Date();
    const rows = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(
      ({ id, title, text, badge, buttonText, link, theme, imageKey }) =>
        present({ id, title, text, badge, buttonText, link, theme, imageKey }),
    );
  }

  async list() {
    const rows = await this.prisma.banner.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(present);
  }

  async create(dto: CreateBannerDto) {
    assertDates(dto);
    const last = await this.prisma.banner.aggregate({
      _max: { position: true },
    });
    const banner = await this.prisma.banner.create({
      data: { ...dto, position: (last._max.position ?? -1) + 1 },
    });
    return present(banner);
  }

  async update(id: string, dto: Partial<CreateBannerDto>) {
    const current = await this.find(id);
    assertDates({
      startsAt: dto.startsAt === undefined ? current.startsAt : dto.startsAt,
      endsAt: dto.endsAt === undefined ? current.endsAt : dto.endsAt,
    });
    const banner = await this.audit.trackUpdate(
      () => this.prisma.banner.findUnique({ where: { id } }),
      () => this.prisma.banner.update({ where: { id }, data: dto }),
      changedKeys(dto),
    );
    return present(banner);
  }

  async remove(id: string) {
    const banner = await this.find(id);
    await this.prisma.banner.delete({ where: { id } });
    // The file goes after the row: a failed delete leaves an orphan file, never a broken image.
    if (banner.imageKey) await this.storage.remove(`${banner.imageKey}.webp`);
  }

  /** New slider order; it must list every banner exactly once. */
  async reorder(ids: string[]) {
    const all = await this.prisma.banner.findMany({ select: { id: true } });
    const known = new Set(all.map((b) => b.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw badRequest(
        'BANNER_ORDER',
        'The order must list every banner exactly once',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.banner.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list();
  }

  /** Stores the picture as WebP (EXIF rotation applied, metadata stripped). */
  async setImage(id: string, file?: { buffer: Buffer; originalname: string }) {
    const banner = await this.find(id);
    if (!file) throw badRequest('NO_FILES', 'No file was uploaded');
    const meta = await sharp(file.buffer)
      .metadata()
      .catch(() => null);
    if (!meta?.format || !ACCEPTED.has(meta.format)) {
      throw badRequest(
        'IMAGE_FORMAT',
        `${file.originalname} is not a JPEG, PNG or WebP image`,
        { file: file.originalname },
      );
    }
    const data = await sharp(file.buffer)
      .rotate()
      .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    // A new key per upload, so browsers never show a cached old picture.
    const imageKey = `banners/${id}/${randomUUID()}`;
    await this.storage.save(`${imageKey}.webp`, data);
    const updated = await this.prisma.banner.update({
      where: { id },
      data: { imageKey },
    });
    if (banner.imageKey) await this.storage.remove(`${banner.imageKey}.webp`);
    return present(updated);
  }

  async removeImage(id: string) {
    const banner = await this.find(id);
    const updated = await this.prisma.banner.update({
      where: { id },
      data: { imageKey: null },
    });
    if (banner.imageKey) await this.storage.remove(`${banner.imageKey}.webp`);
    return present(updated);
  }

  private async find(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }
}

function assertDates(p: { startsAt?: Date | null; endsAt?: Date | null }) {
  if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt)
    throw badRequest('BANNER_DATES', 'The end must be after the start');
}
