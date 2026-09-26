import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransferStatus } from '../generated/prisma/client';
import { AuditService, changedKeys } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const [warehouses, totals, inTransit] = await Promise.all([
      this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.stock.groupBy({
        by: ['warehouseId'],
        _sum: { quantity: true, reserved: true },
      }),
      this.prisma.transfer.findMany({
        where: { status: TransferStatus.IN_TRANSIT },
        select: {
          fromWarehouseId: true,
          toWarehouseId: true,
          items: { select: { quantity: true } },
        },
      }),
    ]);

    const byId = new Map(totals.map((t) => [t.warehouseId, t._sum]));
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    for (const t of inTransit) {
      const units = t.items.reduce((sum, i) => sum + i.quantity, 0);
      incoming.set(
        t.toWarehouseId,
        (incoming.get(t.toWarehouseId) ?? 0) + units,
      );
      outgoing.set(
        t.fromWarehouseId,
        (outgoing.get(t.fromWarehouseId) ?? 0) + units,
      );
    }

    return warehouses.map((w) => {
      const quantity = byId.get(w.id)?.quantity ?? 0;
      const reserved = byId.get(w.id)?.reserved ?? 0;
      return {
        ...w,
        totals: {
          quantity,
          reserved,
          available: quantity - reserved,
          incoming: incoming.get(w.id) ?? 0,
          outgoing: outgoing.get(w.id) ?? 0,
        },
      };
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  update(id: string, dto: UpdateWarehouseDto) {
    return this.audit.trackUpdate(
      () => this.prisma.warehouse.findUnique({ where: { id } }),
      () => this.prisma.warehouse.update({ where: { id }, data: dto }),
      changedKeys(dto),
    );
  }

  // A warehouse with any history must stay for the ledger; it can only be deactivated.
  async remove(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            stock: true,
            movements: true,
            receivings: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (Object.values(warehouse._count).some((n) => n > 0)) {
      throw new ConflictException(
        'Warehouse has stock history; deactivate it instead',
      );
    }
    await this.prisma.warehouse.delete({ where: { id } });
  }
}
