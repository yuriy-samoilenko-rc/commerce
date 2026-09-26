import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { Prisma, TransferStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AdminProductQueryDto, ProductQueryDto, ProductSort } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const relations = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

// What the online shop is allowed to see: no purchase price, barcode or archive flag.
const publicSelect = {
  id: true,
  name: true,
  sku: true,
  model: true,
  description: true,
  attributes: true,
  sellingPrice: true,
  discountPrice: true,
  warrantyMonths: true,
  weightKg: true,
  ...relations,
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

function stockTotals(rows: StockRows['stock']) {
  const quantity = rows.reduce((s, r) => s + r.quantity, 0);
  const reserved = rows.reduce((s, r) => s + r.reserved, 0);
  return { quantity, reserved, available: quantity - reserved };
}

// The shop only learns whether it can be bought, not how many units the company holds.
function presentPublic<T extends StockRows>({ stock, ...product }: T) {
  return { ...product, inStock: stockTotals(stock).available > 0 };
}

// Units in transit are off every warehouse's balance but still belong to the company.
function presentStaff<T extends StockRows & TransitRows>({ stock, transferItems, ...product }: T) {
  const inTransit = transferItems.reduce((s, i) => s + i.quantity, 0);
  return { ...product, stock: { ...stockTotals(stock), inTransit } };
}

const orderBy: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  price_asc: [{ sellingPrice: 'asc' }, { name: 'asc' }],
  price_desc: [{ sellingPrice: 'desc' }, { name: 'asc' }],
  name: [{ name: 'asc' }],
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  async listPublic(query: ProductQueryDto) {
    const where = await this.buildWhere(query, { isArchived: false });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: publicSelect, ...this.pageAndSort(query) }),
      this.prisma.product.count({ where }),
    ]);
    return { items: rows.map(presentPublic), total, page: query.page, limit: query.limit };
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
    return { items: rows.map(presentStaff), total, page: query.page, limit: query.limit };
  }

  async findPublic(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isArchived: false },
      select: publicSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return presentPublic(product);
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
    if (!product) throw new NotFoundException('No product with this barcode or SKU');
    return presentStaff(product);
  }

  async create(dto: CreateProductDto) {
    this.assertDiscountBelowPrice(dto.sellingPrice, dto.discountPrice);
    const product = await this.prisma.product.create({
      data: { ...dto, attributes: dto.attributes as Prisma.InputJsonObject | undefined },
      select: staffSelect(true),
    });
    return presentStaff(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    if (dto.sellingPrice !== undefined || dto.discountPrice !== undefined) {
      const current = await this.prisma.product.findUnique({
        where: { id },
        select: { sellingPrice: true, discountPrice: true },
      });
      if (!current) throw new NotFoundException('Product not found');
      this.assertDiscountBelowPrice(
        dto.sellingPrice ?? current.sellingPrice.toNumber(),
        dto.discountPrice === undefined ? current.discountPrice?.toNumber() : dto.discountPrice,
      );
    }
    const product = await this.prisma.product.update({
      where: { id },
      data: { ...dto, attributes: dto.attributes as Prisma.InputJsonObject | undefined },
      select: staffSelect(true),
    });
    return presentStaff(product);
  }

  async setArchived(id: string, isArchived: boolean) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { isArchived },
      select: staffSelect(true),
    });
    return presentStaff(product);
  }

  private pageAndSort(query: ProductQueryDto) {
    return { orderBy: orderBy[query.sort], ...pageArgs(query) };
  }

  private async buildWhere(query: ProductQueryDto, baseWhere: Prisma.ProductWhereInput) {
    const where: Prisma.ProductWhereInput = { ...baseWhere };

    if (query.categoryId) {
      where.categoryId = { in: await this.categories.withDescendantIds(query.categoryId) };
    }
    if (query.brandId) where.brandId = query.brandId;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.sellingPrice = { gte: query.minPrice, lte: query.maxPrice };
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

  private assertDiscountBelowPrice(sellingPrice: number, discountPrice?: number | null) {
    if (discountPrice != null && discountPrice >= sellingPrice) {
      throw new BadRequestException('discountPrice must be lower than sellingPrice');
    }
  }
}
