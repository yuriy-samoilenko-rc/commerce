import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { Prisma } from '../generated/prisma/client';
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
} satisfies Prisma.ProductSelect;

function staffSelect(canSeeCost: boolean): Prisma.ProductSelect {
  return {
    ...publicSelect,
    barcode: true,
    trackSerial: true,
    vatPercent: true,
    isArchived: true,
    createdAt: true,
    updatedAt: true,
    purchasePrice: canSeeCost,
  };
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

  listPublic(query: ProductQueryDto) {
    return this.list(query, { isArchived: false }, publicSelect);
  }

  listStaff(query: AdminProductQueryDto, canSeeCost: boolean) {
    const archived =
      query.status === 'all' ? {} : { isArchived: query.status === 'archived' };
    return this.list(query, archived, staffSelect(canSeeCost));
  }

  async findPublic(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isArchived: false },
      select: publicSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findStaff(id: string, canSeeCost: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: staffSelect(canSeeCost),
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // Scanners read the barcode; SKU is accepted too for labels printed with it.
  async findByCode(code: string, canSeeCost: boolean) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ barcode: code }, { sku: code }] },
      select: staffSelect(canSeeCost),
    });
    if (!product) throw new NotFoundException('No product with this barcode or SKU');
    return product;
  }

  create(dto: CreateProductDto) {
    this.assertDiscountBelowPrice(dto.sellingPrice, dto.discountPrice);
    return this.prisma.product.create({
      data: { ...dto, attributes: dto.attributes as Prisma.InputJsonObject | undefined },
      select: staffSelect(true),
    });
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
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, attributes: dto.attributes as Prisma.InputJsonObject | undefined },
      select: staffSelect(true),
    });
  }

  setArchived(id: string, isArchived: boolean) {
    return this.prisma.product.update({
      where: { id },
      data: { isArchived },
      select: staffSelect(true),
    });
  }

  private async list(
    query: ProductQueryDto,
    baseWhere: Prisma.ProductWhereInput,
    select: Prisma.ProductSelect,
  ) {
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

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select,
        orderBy: orderBy[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  private assertDiscountBelowPrice(sellingPrice: number, discountPrice?: number | null) {
    if (discountPrice != null && discountPrice >= sellingPrice) {
      throw new BadRequestException('discountPrice must be lower than sellingPrice');
    }
  }
}
