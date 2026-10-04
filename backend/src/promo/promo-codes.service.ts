import { Injectable, NotFoundException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { badRequest, conflict } from '../common/errors';
import { OrderStatus, Prisma, PromoType } from '../generated/prisma/client';
import { OrderItemDto } from '../orders/dto/order.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Tx } from '../stock/stock-ledger.service';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreatePromoCodeDto {
  @Transform(upper)
  @Matches(/^[A-Z0-9_-]{3,40}$/, {
    message: 'code: 3–40 letters, digits, - or _',
  })
  code: string;

  @IsOptional() @IsString() @MaxLength(200) description?: string | null;

  @IsEnum(PromoType) type: PromoType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  value: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minSubtotal?: number | null;

  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional() @IsBoolean() onePerCustomer?: boolean;
  @IsOptional() @IsBoolean() excludeSaleItems?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PromoQuoteDto {
  @Transform(upper)
  @IsString()
  @MaxLength(40)
  code: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

/** A priced order line, as the order would be placed without a promo code. */
export type PricedLine = {
  unitPrice: Prisma.Decimal;
  quantity: number;
  onSale: boolean;
};

type Promo = Prisma.PromoCodeGetPayload<object>;
const ACTIVE_ORDER = { not: OrderStatus.CANCELLED };

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- shop ----------

  /** What a code would give for this cart (checked again, for real, when ordering). */
  async quote(dto: PromoQuoteDto) {
    const now = new Date();
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
        isArchived: false,
      },
      select: {
        id: true,
        sellingPrice: true,
        discountPrice: true,
        discountEndsAt: true,
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines: PricedLine[] = dto.items.flatMap((i) => {
      const p = byId.get(i.productId);
      if (!p) return [];
      const onSale =
        !!p.discountPrice && (!p.discountEndsAt || p.discountEndsAt > now);
      return [
        {
          unitPrice: onSale ? p.discountPrice! : p.sellingPrice,
          quantity: i.quantity,
          onSale,
        },
      ];
    });
    const promo = await this.findUsable(this.prisma, dto.code, now);
    const { discount } = this.calculate(promo, lines);
    return {
      code: promo.code,
      description: promo.description,
      type: promo.type,
      value: promo.value,
      discount,
      excludeSaleItems: promo.excludeSaleItems,
    };
  }

  /**
   * Inside the order transaction: validates the code for this customer, takes one use
   * (atomically, so the last use cannot be taken twice) and returns the lines with the
   * discount spread over them, rounded to cents.
   */
  async applyToOrder<L extends PricedLine>(
    tx: Tx,
    code: string,
    lines: L[],
    userId: string | null,
  ) {
    const promo = await this.findUsable(
      tx,
      code.trim().toUpperCase(),
      new Date(),
    );
    if (promo.onePerCustomer && userId) {
      const used = await tx.order.count({
        where: { userId, promoCodeId: promo.id, status: ACTIVE_ORDER },
      });
      if (used)
        throw conflict(
          'PROMO_ALREADY_USED',
          'This code has already been used on your account',
          { code: promo.code },
        );
    }
    const { eligible, discount } = this.calculate(promo, lines);
    const { count } = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        ...(promo.maxUses !== null && { usedCount: { lt: promo.maxUses } }),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (!count)
      throw conflict('PROMO_USED_UP', 'This code has been used up', {
        code: promo.code,
      });

    const share = discount.div(eligible);
    const priced = lines.map((l) => {
      if (promo.excludeSaleItems && l.onSale) return { ...l, listPrice: null };
      const unitPrice = l.unitPrice
        .mul(new Prisma.Decimal(1).sub(share))
        .toDecimalPlaces(2);
      return { ...l, unitPrice, listPrice: l.unitPrice };
    });
    const before = lines.reduce(
      (s, l) => s.add(l.unitPrice.mul(l.quantity)),
      new Prisma.Decimal(0),
    );
    const after = priced.reduce(
      (s, l) => s.add(l.unitPrice.mul(l.quantity)),
      new Prisma.Decimal(0),
    );
    return {
      promoCodeId: promo.id,
      lines: priced,
      discountTotal: before.sub(after),
    };
  }

  /** A cancelled order gives its use back. */
  async release(tx: Tx, promoCodeId: string) {
    await tx.promoCode.updateMany({
      where: { id: promoCodeId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  private async findUsable(db: Tx | PrismaService, code: string, now: Date) {
    const promo = await db.promoCode.findUnique({ where: { code } });
    if (
      !promo ||
      !promo.isActive ||
      (promo.startsAt && promo.startsAt > now) ||
      (promo.endsAt && promo.endsAt <= now)
    ) {
      throw badRequest('PROMO_INVALID', 'Unknown or expired promo code', {
        code,
      });
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses)
      throw conflict('PROMO_USED_UP', 'This code has been used up', { code });
    return promo;
  }

  /** The discount for these lines: on the eligible ones, never more than they cost. */
  private calculate(promo: Promo, lines: PricedLine[]) {
    const total = (ls: PricedLine[]) =>
      ls.reduce(
        (s, l) => s.add(l.unitPrice.mul(l.quantity)),
        new Prisma.Decimal(0),
      );
    const subtotal = total(lines);
    if (promo.minSubtotal && subtotal.lt(promo.minSubtotal))
      throw badRequest(
        'PROMO_MIN_SUBTOTAL',
        `The code needs an order of at least ${promo.minSubtotal.toString()}`,
        { min: promo.minSubtotal.toString() },
      );
    const eligible = total(
      lines.filter((l) => !(promo.excludeSaleItems && l.onSale)),
    );
    if (eligible.lte(0))
      throw badRequest(
        'PROMO_NOT_APPLICABLE',
        'The code does not apply to these products',
      );
    const raw =
      promo.type === PromoType.PERCENT
        ? eligible.mul(promo.value).div(100)
        : Prisma.Decimal.min(promo.value, eligible);
    return { eligible, discount: raw.toDecimalPlaces(2) };
  }

  // ---------- administration ----------

  list() {
    return this.prisma.promoCode.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { orders: { where: { status: ACTIVE_ORDER } } } },
      },
    });
  }

  create(dto: CreatePromoCodeDto) {
    this.assertSane(dto);
    return this.prisma.promoCode.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreatePromoCodeDto>) {
    const current = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Promo code not found');
    this.assertSane({
      type: dto.type ?? current.type,
      value: dto.value ?? current.value.toNumber(),
      startsAt: dto.startsAt === undefined ? current.startsAt : dto.startsAt,
      endsAt: dto.endsAt === undefined ? current.endsAt : dto.endsAt,
    });
    return this.prisma.promoCode.update({ where: { id }, data: dto });
  }

  private assertSane(p: {
    type: PromoType;
    value: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }) {
    if (p.type === PromoType.PERCENT && p.value > 100)
      throw badRequest('PROMO_PERCENT', 'A percentage cannot exceed 100');
    if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt)
      throw badRequest('PROMO_DATES', 'The end must be after the start');
  }
}
