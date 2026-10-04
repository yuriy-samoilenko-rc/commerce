import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { badRequest, conflict } from '../common/errors';
import { uniqueSlug } from '../common/slug';
import { Prisma, TransferStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  AdminProductQueryDto,
  ProductQueryDto,
  ProductSort,
} from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { imageSelect, presentImage } from './product-images.service';

const relations = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

// What the online shop is allowed to see: no purchase price, barcode or archive flag.
const publicSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  model: true,
  description: true,
  attributes: true,
  sellingPrice: true,
  discountPrice: true,
  discountEndsAt: true,
  shopPrice: true,
  ratingAvg: true,
  ratingCount: true,
  warrantyMonths: true,
  weightKg: true,
  ...relations,
  images: { select: imageSelect, orderBy: { position: 'asc' } },
  // only stock that orders can actually be reserved from
  stock: {
    where: { warehouse: { isActive: true } },
    select: { quantity: true, reserved: true },
  },
} satisfies Prisma.ProductSelect;

function staffSelect(canSeeCost: boolean) {
  return {
    ...publicSelect,
    stock: { select: { quantity: true, reserved: true } },
    barcode: true,
    trackSerial: true,
    lowStockThreshold: true,
    stockAlert: true,
    // customers waiting for a "back in stock" email: a hint for purchasing
    _count: { select: { stockAlerts: true } },
    vatPercent: true,
    isArchived: true,
    createdAt: true,
    updatedAt: true,
    purchasePrice: canSeeCost,
    transferItems: {
      where: { transfer: { status: TransferStatus.IN_TRANSIT } },
      select: { quantity: true },
    },
  } satisfies Prisma.ProductSelect;
}

type StockRows = { stock: { quantity: number; reserved: number }[] };
type TransitRows = { transferItems: { quantity: number }[] };
type ImageRows = { images: Parameters<typeof presentImage>[0][] };

function stockTotals(rows: StockRows['stock']) {
  const quantity = rows.reduce((s, r) => s + r.quantity, 0);
  const reserved = rows.reduce((s, r) => s + r.reserved, 0);
  return { quantity, reserved, available: quantity - reserved };
}

// The shop only learns whether it can be bought, not how many units the company holds.
function presentPublic<T extends StockRows & ImageRows>({
  stock,
  images,
  ...product
}: T) {
  return {
    ...product,
    images: images.map(presentImage),
    inStock: stockTotals(stock).available > 0,
  };
}

// Units in transit are off every warehouse's balance but still belong to the company.
function presentStaff<T extends StockRows & TransitRows & ImageRows>({
  stock,
  transferItems,
  images,
  ...product
}: T) {
  const inTransit = transferItems.reduce((s, i) => s + i.quantity, 0);
  return {
    ...product,
    images: images.map(presentImage),
    stock: { ...stockTotals(stock), inTransit },
  };
}

// The shop sorts and filters by the price customers actually pay.
const orderBy: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  price_asc: [{ shopPrice: 'asc' }, { name: 'asc' }],
  price_desc: [{ shopPrice: 'desc' }, { name: 'asc' }],
  name: [{ name: 'asc' }],
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  async listPublic(query: ProductQueryDto) {
    const where = await this.buildWhere(query, { isArchived: false });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: publicSelect,
        ...this.pageAndSort(query),
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map(presentPublic),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async listStaff(query: AdminProductQueryDto, canSeeCost: boolean) {
    const archived =
      query.status === 'all' ? {} : { isArchived: query.status === 'archived' };
    const where = await this.buildWhere(query, archived);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: staffSelect(canSeeCost),
        ...this.pageAndSort(query),
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map(presentStaff),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findPublic(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isArchived: false },
      select: publicSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return presentPublic(product);
  }

  /** Public view of these products, in the given order (archived ones left out). */
  async findPublicMany(ids: string[]) {
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, isArchived: false },
      select: publicSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [presentPublic(row)] : [];
    });
  }

  /**
   * For a product page: similar products (same category, closest price first) and
   * add-ons for "buy together" (cheap goods from other categories, same brand first).
   */
  async recommendations(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isArchived: false },
      select: { categoryId: true, brandId: true, shopPrice: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const price = product.shopPrice.toNumber();
    const inStock = {
      stock: {
        some: {
          warehouse: { isActive: true },
          quantity: { gt: this.prisma.stock.fields.reserved },
        },
      },
    } satisfies Prisma.ProductWhereInput;
    const categoryIds = await this.categories.withDescendantIds(
      product.categoryId,
    );

    const [sameCategory, addOns] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { not: id },
          isArchived: false,
          categoryId: { in: categoryIds },
        },
        select: publicSelect,
        take: 50,
      }),
      this.prisma.product.findMany({
        where: {
          isArchived: false,
          categoryId: { notIn: categoryIds },
          shopPrice: { lte: Math.max(price * 0.3, 10) },
          ...inStock,
        },
        select: publicSelect,
        orderBy: { shopPrice: 'asc' },
        take: 50,
      }),
    ]);
    const distance = (p: { shopPrice: Prisma.Decimal }) =>
      Math.abs(p.shopPrice.toNumber() - price);
    const sameBrand = (p: { brand: { id: string } | null }) =>
      product.brandId !== null && p.brand?.id === product.brandId;
    return {
      similar: sameCategory
        .sort((a, b) => distance(a) - distance(b))
        .slice(0, 8)
        .map(presentPublic),
      addOns: [
        ...addOns.filter(sameBrand),
        ...addOns.filter((p) => !sameBrand(p)),
      ]
        .slice(0, 6)
        .map(presentPublic),
    };
  }

  async findPublicBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isArchived: false },
      select: publicSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return presentPublic(product);
  }

  /** Slugs of everything the shop sells, for the sitemap. */
  async sitemap() {
    return this.prisma.product.findMany({
      where: { isArchived: false },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
  }

  async findStaff(id: string, canSeeCost: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: staffSelect(canSeeCost),
    });
    if (!product) throw new NotFoundException('Product not found');
    return presentStaff(product);
  }

  // Scanners read the barcode; SKU is accepted too for labels printed with it.
  async findByCode(code: string, canSeeCost: boolean) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ barcode: code }, { sku: code }] },
      select: staffSelect(canSeeCost),
    });
    if (!product)
      throw new NotFoundException('No product with this barcode or SKU');
    return presentStaff(product);
  }

  async create(dto: CreateProductDto) {
    this.assertDiscountBelowPrice(dto.sellingPrice, dto.discountPrice);
    this.assertSaleEnd(dto.discountPrice, dto.discountEndsAt);
    const slug = await uniqueSlug(dto.name, async (s) =>
      Boolean(await this.prisma.product.findUnique({ where: { slug: s } })),
    );
    const product = await this.prisma.product.create({
      data: {
        ...dto,
        slug,
        discountEndsAt: dto.discountPrice == null ? null : dto.discountEndsAt,
        shopPrice: dto.discountPrice ?? dto.sellingPrice,
        attributes: dto.attributes as Prisma.InputJsonObject | undefined,
      },
      select: staffSelect(true),
    });
    return presentStaff(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    if (dto.trackSerial !== undefined)
      await this.assertSerialModeChangeable(id, dto.trackSerial);
    let prices: { shopPrice: number; discountEndsAt?: null } | undefined;
    if (
      dto.sellingPrice !== undefined ||
      dto.discountPrice !== undefined ||
      dto.discountEndsAt !== undefined
    ) {
      const current = await this.prisma.product.findUnique({
        where: { id },
        select: { sellingPrice: true, discountPrice: true },
      });
      if (!current) throw new NotFoundException('Product not found');
      const selling = dto.sellingPrice ?? current.sellingPrice.toNumber();
      const discount =
        dto.discountPrice === undefined
          ? current.discountPrice?.toNumber()
          : dto.discountPrice;
      this.assertDiscountBelowPrice(selling, discount);
      if (dto.discountEndsAt !== undefined)
        this.assertSaleEnd(discount, dto.discountEndsAt);
      prices = {
        shopPrice: discount ?? selling,
        // No discount, no sale end.
        ...(discount == null && { discountEndsAt: null }),
      };
    }
    const product = await this.audit.trackUpdate(
      () => this.prisma.product.findUnique({ where: { id } }),
      () =>
        this.prisma.product.update({
          where: { id },
          data: {
            ...dto,
            ...prices,
            attributes: dto.attributes as Prisma.InputJsonObject | undefined,
          },
          select: staffSelect(true),
        }),
      changedKeys(dto),
    );
    return presentStaff(product);
  }

  async setArchived(id: string, isArchived: boolean) {
    const product = await this.audit.trackUpdate(
      () => this.prisma.product.findUnique({ where: { id } }),
      () =>
        this.prisma.product.update({
          where: { id },
          data: { isArchived },
          select: staffSelect(true),
        }),
      ['isArchived'],
    );
    return presentStaff(product);
  }

  /**
   * Ends sales whose end date has passed: the discount goes, the regular price is back.
   * Returns how many products changed.
   */
  async endExpiredSales(now = new Date()) {
    return this.prisma.$executeRaw`
      UPDATE "products"
      SET "discountPrice" = NULL, "discountEndsAt" = NULL, "shopPrice" = "sellingPrice", "updatedAt" = NOW()
      WHERE "discountEndsAt" IS NOT NULL AND "discountEndsAt" <= ${now}`;
  }

  private pageAndSort(query: ProductQueryDto) {
    return { orderBy: orderBy[query.sort], ...pageArgs(query) };
  }

  private async buildWhere(
    query: ProductQueryDto,
    baseWhere: Prisma.ProductWhereInput,
  ) {
    const where: Prisma.ProductWhereInput = { ...baseWhere };

    if (query.categoryId) {
      where.categoryId = {
        in: await this.categories.withDescendantIds(query.categoryId),
      };
    }
    const brands = [
      ...(query.brandId ? [query.brandId] : []),
      ...(query.brandIds ?? []),
    ];
    if (brands.length) where.brandId = { in: brands };
    if (query.ids?.length) where.id = { in: query.ids };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.shopPrice = { gte: query.minPrice, lte: query.maxPrice };
    }
    if (query.onSale) where.discountPrice = { not: null };
    if (query.inStock) {
      // Some active warehouse has a unit nobody has reserved.
      where.stock = {
        some: {
          warehouse: { isActive: true },
          quantity: { gt: this.prisma.stock.fields.reserved },
        },
      };
    }
    const search = query.search?.trim();
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.OR = [
        { name: contains },
        { sku: contains },
        { model: contains },
        { barcode: search },
        { brand: { name: contains } },
      ];
    }
    return where;
  }

  /**
   * Serial tracking can only be switched while nothing of the product exists yet:
   * with stock on hand, the balance and the serial units would stop matching.
   */
  private async assertSerialModeChangeable(id: string, trackSerial: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        trackSerial: true,
        _count: {
          select: {
            serialUnits: true,
            stock: {
              where: { OR: [{ quantity: { gt: 0 } }, { reserved: { gt: 0 } }] },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.trackSerial === trackSerial) return;
    if (product._count.stock || product._count.serialUnits) {
      throw conflict(
        'SERIAL_MODE_LOCKED',
        'Serial tracking cannot be changed while the product has stock or serial numbers',
      );
    }
  }

  private assertDiscountBelowPrice(
    sellingPrice: number,
    discountPrice?: number | null,
  ) {
    if (discountPrice != null && discountPrice >= sellingPrice) {
      throw badRequest(
        'DISCOUNT_NOT_LOWER',
        'discountPrice must be lower than sellingPrice',
      );
    }
  }

  /** A sale end needs a sale, and must not already be over. */
  private assertSaleEnd(discountPrice?: number | null, endsAt?: Date | null) {
    if (!endsAt) return;
    if (discountPrice == null)
      throw badRequest(
        'SALE_END_WITHOUT_DISCOUNT',
        'discountEndsAt needs a discountPrice',
      );
    if (endsAt.getTime() <= Date.now())
      throw badRequest('SALE_END_PAST', 'discountEndsAt must be in the future');
  }
}
