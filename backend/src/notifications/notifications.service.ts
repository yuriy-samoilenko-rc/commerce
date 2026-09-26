import { Injectable, NotFoundException } from '@nestjs/common';
import {
  formatReceivingNumber,
  formatReturnNumber,
} from '../common/document-numbers';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { NotificationType, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Tx } from '../stock/stock-ledger.service';

// Who is told about what (ТЗ п.20).
const RECIPIENTS: Record<NotificationType, Role[]> = {
  ORDER_NEW: [Role.ADMIN, Role.MANAGER],
  ORDER_PAID: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT],
  ORDER_TO_PICK: [Role.MANAGER, Role.WAREHOUSE],
  ORDER_READY_TO_SHIP: [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE],
  RECEIVING_CONFIRMED: [Role.ADMIN, Role.MANAGER],
  RETURN_REQUESTED: [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE],
  STOCK_LOW: [Role.ADMIN, Role.MANAGER],
  STOCK_OUT: [Role.ADMIN, Role.MANAGER],
  WARRANTY_EXPIRING: [Role.ADMIN, Role.MANAGER],
};

export interface NotificationPayload {
  title: string;
  body?: string | null;
  entityType?: string;
  entityId?: string;
  /** Same key for the same user is stored only once. */
  dedupeKey?: string;
}

type Db = Tx | PrismaService;

// Texts are in Montenegrin (Latin script): they are shown to staff as they are.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Call inside the event's transaction: nothing is announced if it rolls back. */
  async notify(db: Db, type: NotificationType, payload: NotificationPayload) {
    const users = await db.user.findMany({
      where: { role: { in: RECIPIENTS[type] }, isActive: true },
      select: { id: true },
    });
    if (!users.length) return;
    await db.notification.createMany({
      data: users.map((u) => ({ ...payload, type, userId: u.id })),
      skipDuplicates: true,
    });
  }

  async orderEvent(
    db: Db,
    type: 'ORDER_NEW' | 'ORDER_PAID' | 'ORDER_TO_PICK' | 'ORDER_READY_TO_SHIP',
    orderId: string,
  ) {
    const o = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { number: true, customerName: true, total: true },
    });
    const titles = {
      ORDER_NEW: `Nova narudžba br. ${o.number}`,
      ORDER_PAID: `Uplata primljena: narudžba br. ${o.number}`,
      ORDER_TO_PICK: `Narudžba br. ${o.number} čeka pripremu`,
      ORDER_READY_TO_SHIP: `Narudžba br. ${o.number} je spremna za slanje`,
    };
    await this.notify(db, type, {
      title: titles[type],
      body: `${o.customerName}, ukupno ${o.total.toFixed(2).replace('.', ',')} EUR`,
      entityType: 'orders',
      entityId: orderId,
    });
  }

  async receivingConfirmed(db: Db, receivingId: string) {
    const r = await db.receiving.findUniqueOrThrow({
      where: { id: receivingId },
      select: {
        number: true,
        supplier: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
    });
    await this.notify(db, NotificationType.RECEIVING_CONFIRMED, {
      title: `Roba primljena: ${formatReceivingNumber(r.number)}`,
      body: `${r.supplier.name} → ${r.warehouse.name}`,
      entityType: 'receivings',
      entityId: receivingId,
    });
  }

  async returnRequested(db: Db, returnId: string) {
    const r = await db.return.findUniqueOrThrow({
      where: { id: returnId },
      select: {
        number: true,
        order: { select: { number: true, customerName: true } },
      },
    });
    await this.notify(db, NotificationType.RETURN_REQUESTED, {
      title: `Novi zahtjev za povraćaj ${formatReturnNumber(r.number)}`,
      body: `Narudžba br. ${r.order.number}, ${r.order.customerName}`,
      entityType: 'returns',
      entityId: returnId,
    });
  }

  // ---------- the bell ----------

  async listMine(
    userId: string,
    q: PaginationQueryDto & { unreadOnly?: boolean },
  ) {
    const where = { userId, ...(q.unreadOnly && { readAt: null }) };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          readAt: true,
        },
        ...pageArgs(q),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unread, page: q.page, limit: q.limit };
  }

  unreadCount(userId: string) {
    return this.prisma.notification
      .count({ where: { userId, readAt: null } })
      .then((unread) => ({ unread }));
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (!count) throw new NotFoundException('Notification not found');
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return this.unreadCount(userId);
  }
}
