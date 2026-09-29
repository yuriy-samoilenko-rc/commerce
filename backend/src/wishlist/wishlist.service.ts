import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  /** Newest first, as the shop shows them. */
  async list(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });
    return this.products.findPublicMany(rows.map((r) => r.productId));
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isArchived: false },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return this.ids(userId);
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.ids(userId);
  }

  /** Adds a guest's list (unknown or archived products are skipped). */
  async merge(userId: string, productIds: string[]) {
    const existing = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isArchived: false },
      select: { id: true },
    });
    await this.prisma.wishlistItem.createMany({
      data: existing.map((p) => ({ userId, productId: p.id })),
      skipDuplicates: true,
    });
    return this.ids(userId);
  }

  async ids(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });
    return { productIds: rows.map((r) => r.productId) };
  }
}
