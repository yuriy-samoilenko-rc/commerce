import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
import { badRequest, conflict } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  /** For the catalog screen: every brand with how many products use it. */
  async manageList() {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return rows.map(({ _count, ...b }) => ({
      ...b,
      products: _count.products,
    }));
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  create(dto: CreateBrandDto) {
    return this.prisma.brand.create({ data: dto });
  }

  update(id: string, dto: UpdateBrandDto) {
    return this.audit.trackUpdate(
      () => this.prisma.brand.findUnique({ where: { id } }),
      () => this.prisma.brand.update({ where: { id }, data: dto }),
      changedKeys(dto),
    );
  }

  /**
   * Deletes a brand. One with products needs `moveTo`: its products go to that
   * brand first, which is how two spellings of the same brand are merged.
   */
  async remove(id: string, moveTo?: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    const products = brand._count.products;
    if (products && !moveTo) {
      throw conflict('BRAND_IN_USE', `Brand is used by ${products} products`, {
        products,
      });
    }
    if (moveTo === id) {
      throw badRequest(
        'MOVE_TO_INVALID',
        'Cannot move products to the same brand',
      );
    }
    if (
      moveTo &&
      !(await this.prisma.brand.findUnique({ where: { id: moveTo } }))
    ) {
      throw badRequest('MOVE_TO_INVALID', 'Target brand does not exist');
    }
    await this.prisma.$transaction([
      ...(moveTo
        ? [
            this.prisma.product.updateMany({
              where: { brandId: id },
              data: { brandId: moveTo },
            }),
          ]
        : []),
      this.prisma.brand.delete({ where: { id } }),
    ]);
  }
}
