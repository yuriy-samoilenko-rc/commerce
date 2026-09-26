import { Injectable } from '@nestjs/common';
import { NotificationType, StockAlertLevel } from '../generated/prisma/client';
import { CompanySettingsService } from '../settings/company-settings.service';
import type { Tx } from '../stock/stock-ledger.service';
import { NotificationsService } from './notifications.service';

const RANK: Record<StockAlertLevel, number> = { OK: 0, LOW: 1, OUT: 2 };

/**
 * "Malo robe" / "Nema na stanju" (ТЗ п.20). The product remembers the level it last
 * announced, so staff are told once when stock crosses the threshold, not on every sale.
 */
@Injectable()
export class StockAlertService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly company: CompanySettingsService,
  ) {}

  async check(tx: Tx, productId: string) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        sku: true,
        isArchived: true,
        lowStockThreshold: true,
        stockAlert: true,
      },
    });
    if (!product || product.isArchived) return;

    const threshold =
      product.lowStockThreshold ??
      (await this.company.get(tx)).lowStockThreshold;
    // What the shop can still sell: unreserved units on active warehouses.
    const [{ available }] = await tx.$queryRaw<{ available: number }[]>`
      SELECT COALESCE(SUM(s."quantity" - s."reserved"), 0)::int AS available
      FROM "stock" s JOIN "warehouses" w ON w."id" = s."warehouseId"
      WHERE s."productId" = ${productId} AND w."isActive"`;
    const level =
      available <= 0
        ? StockAlertLevel.OUT
        : available <= threshold
          ? StockAlertLevel.LOW
          : StockAlertLevel.OK;
    if (level === product.stockAlert) return;

    // Conditional update: of two concurrent transactions only one announces the change.
    const { count } = await tx.product.updateMany({
      where: { id: productId, stockAlert: product.stockAlert },
      data: { stockAlert: level },
    });
    if (!count || RANK[level] <= RANK[product.stockAlert]) return;

    await this.notifications.notify(
      tx,
      level === StockAlertLevel.OUT
        ? NotificationType.STOCK_OUT
        : NotificationType.STOCK_LOW,
      {
        title:
          level === StockAlertLevel.OUT
            ? `Nema na stanju: ${product.name}`
            : `Malo robe: ${product.name}`,
        body: `Šifra ${product.sku}, dostupno: ${available} (prag: ${threshold})`,
        entityType: 'products',
        entityId: productId,
      },
    );
  }
}
