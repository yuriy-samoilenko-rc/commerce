import { Injectable, NotFoundException } from '@nestjs/common';
import { localYear } from '../common/timezone';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import {
  DocumentStatus,
  DocumentType,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanySettingsService } from '../settings/company-settings.service';
import { Tx } from '../stock/stock-ledger.service';
import {
  BuiltDocument,
  buildDeliveryNote,
  buildInventoryAct,
  buildInvoice,
  buildReceivingNote,
  buildReturnNote,
  buildTransferNote,
  buildWarrantyCard,
} from './document-builders';
import { DocumentData, NUMBER_PREFIX } from './document-data';
import { renderPdf } from './pdf-renderer';

export class DocumentQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
  @IsOptional() @IsUUID() orderId?: string;
  @IsOptional() @IsUUID() receivingId?: string;
  @IsOptional() @IsUUID() transferId?: string;
  @IsOptional() @IsUUID() returnId?: string;
  @IsOptional() @IsUUID() inventoryCountId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  /** Document number or counterparty name */
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

const listSelect = {
  id: true,
  type: true,
  number: true,
  status: true,
  title: true,
  issuedAt: true,
  cancelledAt: true,
  cancelReason: true,
  counterpartyName: true,
  total: true,
  currency: true,
  orderId: true,
  receivingId: true,
  transferId: true,
  returnId: true,
  inventoryCountId: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanySettingsService,
  ) {}

  /**
   * Issues a document inside the caller's transaction, so it exists exactly when the
   * business event does, and its number is only consumed if the event commits.
   */
  async issue(
    tx: Tx,
    type: DocumentType,
    sourceId: string,
    userId: string,
  ): Promise<string | null> {
    const company = await this.company.get(tx);
    const issuer = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const built: BuiltDocument | null = await {
      INVOICE: () => buildInvoice(tx, sourceId, company),
      DELIVERY_NOTE: () =>
        buildDeliveryNote(tx, sourceId, company, issuer?.name ?? '—'),
      WARRANTY_CARD: () => buildWarrantyCard(tx, sourceId, company),
      RECEIVING_NOTE: () => buildReceivingNote(tx, sourceId, company),
      TRANSFER_NOTE: () => buildTransferNote(tx, sourceId, company),
      RETURN_NOTE: () => buildReturnNote(tx, sourceId, company),
      INVENTORY_ACT: () => buildInventoryAct(tx, sourceId, company),
    }[type]();
    if (!built) return null;

    const issuedAt = new Date();
    // Local year: an invoice issued on 1 January at 00:30 belongs to the new year.
    const year = localYear(issuedAt);
    // The counter row stays locked until commit: numbers are sequential with no gaps,
    // which accountants expect from invoices.
    const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
      INSERT INTO "document_counters" ("type", "year", "last")
      VALUES (${type}::"DocumentType", ${year}, 1)
      ON CONFLICT ("type", "year") DO UPDATE SET "last" = "document_counters"."last" + 1
      RETURNING "last"`;

    const doc = await tx.document.create({
      data: {
        type,
        number: `${NUMBER_PREFIX[type]}-${year}-${String(last).padStart(6, '0')}`,
        year,
        seq: last,
        issuedAt,
        title: built.data.title,
        counterpartyName: built.counterpartyName ?? null,
        total: built.total ?? null,
        currency: company.currency,
        data: built.data as unknown as Prisma.InputJsonObject,
        ...built.links,
        createdById: userId,
      },
      select: { id: true },
    });
    return doc.id;
  }

  /** A cancelled order voids its invoice; the number stays used, as required for invoices. */
  cancelOrderInvoices(tx: Tx, orderId: string, reason: string) {
    return tx.document.updateMany({
      where: {
        orderId,
        type: DocumentType.INVOICE,
        status: DocumentStatus.ISSUED,
      },
      data: {
        status: DocumentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  }

  async list(q: DocumentQueryDto, onlyCustomerId?: string) {
    const where: Prisma.DocumentWhereInput = {
      type: q.type,
      status: q.status,
      orderId: q.orderId,
      receivingId: q.receivingId,
      transferId: q.transferId,
      returnId: q.returnId,
      inventoryCountId: q.inventoryCountId,
      supplierId: q.supplierId,
      warehouseId: q.warehouseId,
      customerId: onlyCustomerId ?? q.customerId,
      issuedAt: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
    };
    const search = q.search?.trim();
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { counterpartyName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        select: listSelect,
        orderBy: { issuedAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.document.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async findOne(id: string, onlyCustomerId?: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, ...(onlyCustomerId && { customerId: onlyCustomerId }) },
      select: { ...listSelect, data: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async pdf(id: string, onlyCustomerId?: string) {
    const doc = await this.findOne(id, onlyCustomerId);
    const buffer = await renderPdf({
      number: doc.number,
      issuedAt: doc.issuedAt,
      cancelled: doc.status === DocumentStatus.CANCELLED,
      data: doc.data as unknown as DocumentData,
    });
    return { buffer, fileName: `${doc.number}.pdf` };
  }
}
