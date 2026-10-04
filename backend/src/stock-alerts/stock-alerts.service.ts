import { Injectable, NotFoundException } from '@nestjs/common';
import { IsEmail, MaxLength } from 'class-validator';
import { badRequest } from '../common/errors';
import { shopUrl } from '../common/shop-url';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export class StockAlertDto {
  @IsEmail()
  @MaxLength(200)
  email: string;
}

@Injectable()
export class StockAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private availableWhere() {
    return {
      some: {
        warehouse: { isActive: true },
        quantity: { gt: this.prisma.stock.fields.reserved },
      },
    };
  }

  /** "Let me know when it is back": one entry per product and email, guests welcome. */
  async subscribe(productId: string, email: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isArchived: false },
      select: { id: true, stock: { where: this.availableWhere().some } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.stock.length)
      throw badRequest('PRODUCT_IN_STOCK', 'The product is in stock');
    await this.prisma.stockAlertSubscription.upsert({
      where: {
        productId_email: { productId, email: email.trim().toLowerCase() },
      },
      create: { productId, email: email.trim().toLowerCase() },
      update: {},
    });
    return { subscribed: true };
  }

  /**
   * Emails everyone waiting for a product that can be bought again, then forgets the
   * address. Each row is deleted in the same transaction that queues its email, so two
   * servers never send it twice. Returns how many were sent.
   */
  async notifyAvailable() {
    const due = await this.prisma.stockAlertSubscription.findMany({
      where: {
        product: { isArchived: false, stock: this.availableWhere() },
      },
      select: {
        id: true,
        email: true,
        product: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    let sent = 0;
    for (const s of due) {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.stockAlertSubscription.deleteMany({
          where: { id: s.id },
        });
        if (!count) return;
        await this.mail.stockBackEmail(
          tx,
          s.email,
          s.product,
          `${shopUrl()}/proizvod/${s.product.slug}`,
        );
        sent += 1;
      });
    }
    return sent;
  }
}
