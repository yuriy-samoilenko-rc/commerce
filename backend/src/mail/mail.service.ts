import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatReturnNumber } from '../common/document-numbers';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { EmailStatus, Prisma } from '../generated/prisma/client';
import { orderSettings } from '../orders/order-settings';
import { PrismaService } from '../prisma/prisma.service';
import { CompanySettingsService } from '../settings/company-settings.service';
import type { Tx } from '../stock/stock-ledger.service';
import {
  documentEmail,
  EmailContent,
  orderCancelled,
  orderConfirmed,
  orderReceived,
  orderShipped,
  returnDecided,
} from './email-templates';

type Db = Tx | PrismaService;
export type OrderEmail = 'RECEIVED' | 'CONFIRMED' | 'SHIPPED' | 'CANCELLED';

/**
 * Transactional outbox: emails are *queued* in the same transaction as the event and
 * sent later by MailWorker. A slow or broken mail server never fails an order, and a
 * rolled-back order never sends "your order is confirmed".
 */
@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanySettingsService,
  ) {}

  enqueue(
    db: Db,
    to: string,
    content: EmailContent,
    extra: { documentIds?: string[]; orderId?: string } = {},
  ) {
    return db.emailOutbox.create({
      data: {
        to,
        ...content,
        documentIds: (extra.documentIds ?? []).filter(Boolean),
        orderId: extra.orderId,
      },
      select: { id: true },
    });
  }

  /** Nothing is queued for orders without an email address (e.g. phone orders). */
  async orderEmail(
    db: Db,
    kind: OrderEmail,
    orderId: string,
    documentIds: (string | null)[] = [],
  ) {
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order.customerEmail) return;
    const company = await this.company.get(db);
    const content = {
      RECEIVED: () =>
        orderReceived(company, order, orderSettings().paymentTtlMs / 60_000),
      CONFIRMED: () => orderConfirmed(company, order),
      SHIPPED: () => orderShipped(company, order),
      CANCELLED: () => orderCancelled(company, order),
    }[kind]();
    await this.enqueue(db, order.customerEmail, content, {
      orderId,
      documentIds: documentIds.filter((d): d is string => !!d),
    });
  }

  async returnEmail(db: Db, returnId: string, documentId: string | null) {
    const r = await db.return.findUniqueOrThrow({
      where: { id: returnId },
      select: { number: true, status: true, refundAmount: true, order: true },
    });
    if (!r.order.customerEmail) return;
    const company = await this.company.get(db);
    const content = returnDecided(
      company,
      { ...r, number: formatReturnNumber(r.number) },
      r.order,
    );
    await this.enqueue(db, r.order.customerEmail, content, {
      orderId: r.order.id,
      documentIds: documentId ? [documentId] : [],
    });
  }

  /** "Poslati klijentu" (ТЗ п.11): the customer's or supplier's address unless one is given. */
  async sendDocument(documentId: string, to?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        number: true,
        order: { select: { id: true, customerEmail: true } },
        supplier: { select: { email: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const address = to ?? doc.order?.customerEmail ?? doc.supplier?.email;
    if (!address)
      throw new BadRequestException('No email address on file; pass "to"');
    const company = await this.company.get();
    const queued = await this.enqueue(
      this.prisma,
      address,
      documentEmail(company, doc),
      {
        documentIds: [doc.id],
        orderId: doc.order?.id,
      },
    );
    return { queued: queued.id, to: address };
  }

  // ---------- admin view of the queue ----------

  async list(
    q: PaginationQueryDto & { status?: EmailStatus; orderId?: string },
  ) {
    const where: Prisma.EmailOutboxWhereInput = {
      status: q.status,
      orderId: q.orderId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailOutbox.findMany({
        where,
        select: {
          id: true,
          to: true,
          subject: true,
          status: true,
          attempts: true,
          lastError: true,
          documentIds: true,
          orderId: true,
          sendAfter: true,
          sentAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.emailOutbox.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async retry(id: string) {
    const { count } = await this.prisma.emailOutbox.updateMany({
      where: { id, status: EmailStatus.FAILED },
      data: {
        status: EmailStatus.PENDING,
        attempts: 0,
        sendAfter: new Date(),
        lastError: null,
      },
    });
    if (!count)
      throw new BadRequestException('Only failed emails can be retried');
    return { id, status: EmailStatus.PENDING };
  }
}
