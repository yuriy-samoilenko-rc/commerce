import { Injectable, NotFoundException } from '@nestjs/common';
import { warrantyUntil } from '../common/dates';
import { formatWarrantyNumber } from '../common/document-numbers';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { conflict, notFound } from '../common/errors';
import {
  Prisma,
  SerialUnitStatus,
  WarrantyStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import {
  CreateWarrantyCaseDto,
  ReplaceUnitDto,
  WarrantyQueryDto,
} from './dto/warranty.dto';

const OPEN: WarrantyStatus[] = [
  WarrantyStatus.OPEN,
  WarrantyStatus.RECEIVED,
  WarrantyStatus.IN_SERVICE,
  WarrantyStatus.REPAIRED,
];

const unitSelect = {
  id: true,
  serialNumber: true,
  status: true,
  soldAt: true,
  product: {
    select: { id: true, name: true, sku: true, warrantyMonths: true },
  },
  orderItem: {
    select: {
      order: {
        select: {
          id: true,
          number: true,
          customerName: true,
          customerPhone: true,
        },
      },
    },
  },
} satisfies Prisma.SerialUnitSelect;

const caseSelect = {
  id: true,
  number: true,
  status: true,
  problem: true,
  serviceCenter: true,
  resolutionNote: true,
  receivedAt: true,
  sentToServiceAt: true,
  repairedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  serialUnit: { select: unitSelect },
  replacementUnit: { select: { id: true, serialNumber: true } },
  warehouse: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.WarrantyCaseSelect;

type CaseRow = Prisma.WarrantyCaseGetPayload<{ select: typeof caseSelect }>;

function present({ serialUnit: { orderItem, ...unit }, ...c }: CaseRow) {
  return {
    ...c,
    number: formatWarrantyNumber(c.number),
    unit: {
      ...unit,
      warrantyUntil: warrantyUntil(unit.soldAt, unit.product.warrantyMonths),
    },
    order: orderItem?.order ?? null,
  };
}

/** Warranty cases (ТЗ п.16, UI screen 21). The customer keeps ownership; no money moves. */
@Injectable()
export class WarrantyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
  ) {}

  async create(dto: CreateWarrantyCaseDto, userId: string) {
    const unit = await this.prisma.serialUnit.findUnique({
      where: { serialNumber: dto.serialNumber.trim() },
      select: {
        id: true,
        status: true,
        soldAt: true,
        product: { select: { warrantyMonths: true } },
      },
    });
    if (!unit)
      throw notFound('SERIAL_NOT_FOUND', 'Serial number not found', {
        serial: dto.serialNumber.trim(),
      });
    if (unit.status !== SerialUnitStatus.SOLD) {
      throw conflict(
        'WARRANTY_UNIT_NOT_SOLD',
        `Unit is ${unit.status}; only sold units are under warranty`,
        { status: unit.status },
      );
    }
    const until = warrantyUntil(unit.soldAt, unit.product.warrantyMonths);
    if (!until) throw conflict('NO_WARRANTY', 'This product has no warranty');
    if (until <= new Date()) {
      throw conflict(
        'WARRANTY_EXPIRED',
        `Warranty expired on ${until.toISOString().slice(0, 10)}`,
        { until: until.toISOString() },
      );
    }

    const open = await this.prisma.warrantyCase.findFirst({
      where: { serialUnitId: unit.id, status: { in: OPEN } },
      select: { number: true },
    });
    if (open) {
      const number = formatWarrantyNumber(open.number);
      throw conflict(
        'WARRANTY_ALREADY_OPEN',
        `${number} is already open for this unit`,
        { case: number },
      );
    }

    // The partial unique index still guards the race between the check and the insert.
    const c = await this.prisma.warrantyCase.create({
      data: {
        serialUnitId: unit.id,
        problem: dto.problem,
        createdById: userId,
      },
      select: { id: true },
    });
    return this.findOne(c.id);
  }

  /** The customer brought the unit in: it is now in our custody. */
  async receive(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const unitId = await this.transition(
        tx,
        id,
        [WarrantyStatus.OPEN],
        { status: WarrantyStatus.RECEIVED, receivedAt: new Date() },
        'received',
      );
      await this.setUnit(
        tx,
        unitId,
        SerialUnitStatus.SOLD,
        SerialUnitStatus.IN_SERVICE,
      );
    });
    return this.findOne(id);
  }

  async sendToService(id: string, serviceCenter: string) {
    await this.prisma.$transaction((tx) =>
      this.transition(
        tx,
        id,
        [WarrantyStatus.RECEIVED],
        {
          status: WarrantyStatus.IN_SERVICE,
          serviceCenter,
          sentToServiceAt: new Date(),
        },
        'sent to service',
      ),
    );
    return this.findOne(id);
  }

  async repairCompleted(id: string, note?: string) {
    await this.prisma.$transaction((tx) =>
      this.transition(
        tx,
        id,
        [WarrantyStatus.IN_SERVICE],
        {
          status: WarrantyStatus.REPAIRED,
          repairedAt: new Date(),
          resolutionNote: note ?? null,
        },
        'marked as repaired',
      ),
    );
    return this.findOne(id);
  }

  /** Hand the unit (repaired, or checked and found fine) back to its owner. */
  async returnToCustomer(id: string, note?: string) {
    await this.prisma.$transaction(async (tx) => {
      const unitId = await this.transition(
        tx,
        id,
        [WarrantyStatus.RECEIVED, WarrantyStatus.REPAIRED],
        {
          status: WarrantyStatus.CLOSED,
          closedAt: new Date(),
          ...(note && { resolutionNote: note }),
        },
        'closed',
      );
      await this.setUnit(
        tx,
        unitId,
        SerialUnitStatus.IN_SERVICE,
        SerialUnitStatus.SOLD,
      );
    });
    return this.findOne(id);
  }

  /** Give a new unit from stock instead; the faulty one is written off. */
  async replace(id: string, dto: ReplaceUnitDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const unitId = await this.transition(
        tx,
        id,
        [
          WarrantyStatus.RECEIVED,
          WarrantyStatus.IN_SERVICE,
          WarrantyStatus.REPAIRED,
        ],
        {
          status: WarrantyStatus.REPLACED,
          closedAt: new Date(),
          warehouseId: dto.warehouseId,
          resolutionNote: dto.note ?? null,
        },
        'replaced',
      );
      const replacementId = await this.ledger.replaceUnit(tx, {
        faultyUnitId: unitId,
        serialNumber: dto.serialNumber.trim(),
        warehouseId: dto.warehouseId,
        userId,
        warrantyCaseId: id,
      });
      await tx.warrantyCase.update({
        where: { id },
        data: { replacementUnitId: replacementId },
      });
    });
    return this.findOne(id);
  }

  /** Not a warranty case (e.g. physical damage); the unit goes back as it is. */
  async reject(id: string, note: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.warrantyCase.findUnique({
        where: { id },
        select: { status: true },
      });
      const unitId = await this.transition(
        tx,
        id,
        [WarrantyStatus.OPEN, WarrantyStatus.RECEIVED],
        {
          status: WarrantyStatus.REJECTED,
          closedAt: new Date(),
          resolutionNote: note,
        },
        'rejected',
      );
      if (before?.status === WarrantyStatus.RECEIVED) {
        await this.setUnit(
          tx,
          unitId,
          SerialUnitStatus.IN_SERVICE,
          SerialUnitStatus.SOLD,
        );
      }
    });
    return this.findOne(id);
  }

  async findOne(id: string) {
    const c = await this.prisma.warrantyCase.findUnique({
      where: { id },
      select: caseSelect,
    });
    if (!c) throw new NotFoundException('Warranty case not found');
    return present(c);
  }

  async list(q: WarrantyQueryDto) {
    const where = { status: q.status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.warrantyCase.findMany({
        where,
        select: caseSelect,
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.warrantyCase.count({ where }),
    ]);
    return { items: rows.map(present), total, page: q.page, limit: q.limit };
  }

  private async transition(
    tx: Tx,
    id: string,
    from: WarrantyStatus[],
    data: Prisma.WarrantyCaseUncheckedUpdateManyInput,
    action: string,
  ) {
    const { count } = await tx.warrantyCase.updateMany({
      where: { id, status: { in: from } },
      data,
    });
    const c = await tx.warrantyCase.findUnique({
      where: { id },
      select: { status: true, serialUnitId: true },
    });
    if (!c) throw new NotFoundException('Warranty case not found');
    if (!count)
      throw conflict(
        'WARRANTY_WRONG_STATE',
        `Warranty case is ${c.status} and cannot be ${action}`,
        { status: c.status },
      );
    return c.serialUnitId;
  }

  private async setUnit(
    tx: Tx,
    unitId: string,
    from: SerialUnitStatus,
    to: SerialUnitStatus,
  ) {
    const { count } = await tx.serialUnit.updateMany({
      where: { id: unitId, status: from },
      data: { status: to },
    });
    if (!count)
      throw conflict('UNIT_STATE_CHANGED', `The unit is no longer ${from}`, {
        status: from,
      });
  }
}
