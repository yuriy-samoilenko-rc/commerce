import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
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

  async remove(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand._count.products) {
      throw new ConflictException(
        `Brand is used by ${brand._count.products} products`,
      );
    }
    await this.prisma.brand.delete({ where: { id } });
  }
}
