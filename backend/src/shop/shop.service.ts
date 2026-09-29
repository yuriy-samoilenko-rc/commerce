import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { presentImage } from '../products/product-images.service';
import { returnWindowDays } from '../returns/returns.service';
import { CompanySettingsService } from '../settings/company-settings.service';

export interface ShopCategory {
  id: string;
  name: string;
  parentId: string | null;
  /** Products on sale in this category and all below it. */
  productCount: number;
  /** A product photo to show for the category, if any product has one. */
  image: { url: string; thumbUrl: string } | null;
  children: ShopCategory[];
}

/** What the online shop shows about the company, delivery and its stores. */
@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CompanySettingsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  /** Brands (with counts) and the price range of a catalog listing, for its filters. */
  async facets(query: {
    categoryId?: string;
    search?: string;
    onSale?: boolean;
  }) {
    const where: Prisma.ProductWhereInput = { isArchived: false };
    if (query.categoryId)
      where.categoryId = {
        in: await this.categoriesService.withDescendantIds(query.categoryId),
      };
    if (query.onSale) where.discountPrice = { not: null };
    const search = query.search?.trim();
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.OR = [
        { name: contains },
        { sku: contains },
        { model: contains },
        { brand: { name: contains } },
      ];
    }
    const [byBrand, range] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['brandId'],
        where: { ...where, brandId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.product.aggregate({
        where,
        _min: { shopPrice: true },
        _max: { shopPrice: true },
      }),
    ]);
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: byBrand.map((b) => b.brandId!) } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const counts = new Map(byBrand.map((b) => [b.brandId, b._count._all]));
    return {
      brands: brands.map((b) => ({ ...b, count: counts.get(b.id) ?? 0 })),
      minPrice: range._min.shopPrice,
      maxPrice: range._max.shopPrice,
    };
  }

  async info() {
    const [s, pickupPoints] = await Promise.all([
      this.settings.get(),
      this.prisma.warehouse.findMany({
        where: { isActive: true, isPickupPoint: true },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          openingHours: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      name: s.name,
      legalName: s.legalName,
      address: s.address,
      taxId: s.taxId,
      phone: s.phone,
      email: s.email,
      website: s.website,
      currency: s.currency,
      courierFee: s.courierFee,
      freeShippingFrom: s.freeShippingFrom,
      returnWindowDays: returnWindowDays(),
      pickupPoints,
    };
  }

  /** The category tree with product counts and a photo per category, for menus and tiles. */
  async categories(): Promise<ShopCategory[]> {
    const [rows, counts, pictured] = await Promise.all([
      this.prisma.category.findMany({
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { isArchived: false },
        _count: { _all: true },
      }),
      // One photographed product per category: the dearest one tends to be the flagship.
      this.prisma.product.findMany({
        where: { isArchived: false, images: { some: {} } },
        distinct: ['categoryId'],
        orderBy: [{ categoryId: 'asc' }, { shopPrice: 'desc' }],
        select: {
          categoryId: true,
          images: {
            orderBy: { position: 'asc' },
            take: 1,
            select: {
              id: true,
              fileKey: true,
              width: true,
              height: true,
              alt: true,
              position: true,
            },
          },
        },
      }),
    ]);
    const own = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    const photo = new Map(
      pictured.map((p) => {
        const { url, thumbUrl } = presentImage(p.images[0]);
        return [p.categoryId, { url, thumbUrl }];
      }),
    );
    const nodes = new Map<string, ShopCategory>(
      rows.map((r) => [
        r.id,
        {
          ...r,
          productCount: own.get(r.id) ?? 0,
          image: photo.get(r.id) ?? null,
          children: [],
        },
      ]),
    );
    const roots: ShopCategory[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    // A parent counts everything below it and borrows a child's photo if it has none.
    const total = (n: ShopCategory): number => {
      n.productCount += n.children.reduce((s, c) => s + total(c), 0);
      n.image ??= n.children.find((c) => c.image)?.image ?? null;
      return n.productCount;
    };
    roots.forEach(total);
    return roots;
  }
}
