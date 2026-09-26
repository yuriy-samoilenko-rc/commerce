import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { day } from '../documents/document-data';
import { NotificationType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/**
 * "Garancija uskoro ističe" (ТЗ п.20): periodically finds sold units whose warranty ends
 * within WARRANTY_REMINDER_DAYS. Each unit is announced once (dedupe key per unit).
 */
@Injectable()
export class WarrantyReminderService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WarrantyReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    const every = num('WARRANTY_REMINDER_INTERVAL_SECONDS', 6 * 3600) * 1000;
    this.timer = setInterval(() => void this.run(), every);
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const days = num('WARRANTY_REMINDER_DAYS', 30);
      const units = await this.prisma.$queryRaw<
        {
          id: string;
          serialNumber: string;
          productName: string;
          until: Date;
          customerName: string | null;
        }[]
      >`
        SELECT u."id", u."serialNumber", p."name" AS "productName",
               u."soldAt" + make_interval(months => p."warrantyMonths") AS "until",
               o."customerName"
        FROM "serial_units" u
        JOIN "products" p ON p."id" = u."productId"
        LEFT JOIN "order_items" oi ON oi."id" = u."orderItemId"
        LEFT JOIN "orders" o ON o."id" = oi."orderId"
        WHERE u."status" = 'SOLD' AND u."soldAt" IS NOT NULL AND p."warrantyMonths" IS NOT NULL
          AND u."soldAt" + make_interval(months => p."warrantyMonths")
              BETWEEN now() AND now() + make_interval(days => ${days}::int)`;
      for (const u of units) {
        await this.notifications.notify(
          this.prisma,
          NotificationType.WARRANTY_EXPIRING,
          {
            title: `Garancija ističe ${day(u.until)}: ${u.productName}`,
            body: `Serijski broj ${u.serialNumber}${u.customerName ? `, kupac ${u.customerName}` : ''}`,
            entityType: 'serials',
            entityId: u.serialNumber,
            dedupeKey: `warranty-expiring:${u.id}`,
          },
        );
      }
    } catch (e) {
      this.logger.error(
        'Warranty reminder failed',
        e instanceof Error ? e.stack : e,
      );
    } finally {
      this.running = false;
    }
  }
}
