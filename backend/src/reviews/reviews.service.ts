import { Injectable, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { badRequest, conflict } from '../common/errors';
import { OrderStatus, Prisma, ReviewStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Tx } from '../stock/stock-ledger.service';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  text: string;
}

export class ReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

/** Orders in which the goods have reached the customer. */
const RECEIVED: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.PARTIALLY_RETURNED,
  OrderStatus.RETURNED,
];

/** "Marko Petrović" → "Marko P." — the shop never shows full names or emails. */
const displayName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
};

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Approved reviews of a product with the rating summary. */
  async listForProduct(productId: string, query: PaginationQueryDto) {
    const where = { productId, status: ReviewStatus.APPROVED };
    const [[rows, total], groups] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.review.findMany({
          where,
          select: {
            id: true,
            rating: true,
            title: true,
            text: true,
            createdAt: true,
            user: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          ...pageArgs(query),
        }),
        this.prisma.review.count({ where }),
      ]),
      // Outside the batch: groupBy in a $transaction array defeats the type checker.
      this.prisma.review.groupBy({
        by: ['rating'],
        where,
        _count: { _all: true },
      }),
    ]);
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: groups.find((g) => g.rating === stars)?._count._all ?? 0,
    }));
    const sum = distribution.reduce((s, d) => s + d.stars * d.count, 0);
    return {
      items: rows.map(({ user, ...r }) => ({
        ...r,
        author: displayName(user.name),
        verified: true,
      })),
      total,
      page: query.page,
      limit: query.limit,
      summary: {
        count: total,
        average: total ? Math.round((sum / total) * 10) / 10 : null,
        distribution,
      },
    };
  }

  /** Whether the customer may review the product, and their review if there is one. */
  async eligibility(productId: string, userId: string) {
    const [received, mine] = await Promise.all([
      this.hasReceived(productId, userId),
      this.prisma.review.findUnique({
        where: { productId_userId: { productId, userId } },
        select: { id: true, rating: true, status: true, createdAt: true },
      }),
    ]);
    return { canReview: received && !mine, received, review: mine };
  }

  async create(productId: string, userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isArchived: false },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!(await this.hasReceived(productId, userId))) {
      throw badRequest(
        'REVIEW_NOT_ALLOWED',
        'Only customers who received this product can review it',
      );
    }
    try {
      return await this.prisma.review.create({
        data: {
          productId,
          userId,
          rating: dto.rating,
          title: dto.title?.trim() || null,
          text: dto.text.trim(),
        },
        select: { id: true, rating: true, status: true, createdAt: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw conflict(
          'REVIEW_EXISTS',
          'You have already reviewed this product',
        );
      }
      throw e;
    }
  }

  listMine(userId: string) {
    return this.prisma.review.findMany({
      where: { userId },
      select: {
        id: true,
        rating: true,
        title: true,
        text: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- moderation ----------

  async listForStaff(query: ReviewQueryDto) {
    const where: Prisma.ReviewWhereInput = { status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          text: true,
          status: true,
          createdAt: true,
          moderatedAt: true,
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, name: true, email: true } },
          moderatedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Approving or rejecting; the product's rating follows the approved reviews. */
  async moderate(id: string, status: ReviewStatus, staffId: string) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review
        .update({
          where: { id },
          data: { status, moderatedAt: new Date(), moderatedById: staffId },
          select: { id: true, status: true, productId: true },
        })
        .catch((e: unknown) => {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            throw new NotFoundException('Review not found');
          throw e;
        });
      await this.refreshRating(tx, review.productId);
      return review;
    });
  }

  private async refreshRating(tx: Tx, productId: string) {
    const agg = await tx.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        ratingCount: agg._count._all,
        ratingAvg:
          agg._avg.rating === null
            ? null
            : Math.round(agg._avg.rating * 100) / 100,
      },
    });
  }

  private async hasReceived(productId: string, userId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, status: { in: RECEIVED } },
      },
      select: { id: true },
    });
    return item !== null;
  }
}
