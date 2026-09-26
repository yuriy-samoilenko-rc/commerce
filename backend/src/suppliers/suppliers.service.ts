import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  update(id: string, dto: UpdateSupplierDto) {
    return this.audit.trackUpdate(
      () => this.prisma.supplier.findUnique({ where: { id } }),
      () => this.prisma.supplier.update({ where: { id }, data: dto }),
      changedKeys(dto),
    );
  }

  async remove(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: { _count: { select: { receivings: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (supplier._count.receivings) {
      throw new ConflictException(
        'Supplier has receivings; deactivate it instead',
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
  }
}
