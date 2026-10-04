import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { shopUrl } from '../common/shop-url';
import { Prisma, QuestionStatus } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export class AskQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  question: string;
}

export class AnswerQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(3000)
  answer: string;
}

export class QuestionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;
}

/** "Marko Petrović" → "Marko P.", as reviews show it. */
const displayName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Answered questions of a product, newest first. */
  async listForProduct(productId: string, query: PaginationQueryDto) {
    const where = { productId, status: QuestionStatus.PUBLISHED };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.productQuestion.findMany({
        where,
        select: {
          id: true,
          question: true,
          answer: true,
          answeredAt: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { answeredAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.productQuestion.count({ where }),
    ]);
    return {
      items: rows.map(({ user, ...q }) => ({
        ...q,
        author: displayName(user.name),
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async ask(productId: string, userId: string, dto: AskQuestionDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isArchived: false },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.productQuestion.create({
      data: { productId, userId, question: dto.question.trim() },
      select: { id: true, status: true, createdAt: true },
    });
  }

  /** The customer's own questions, answered or not. */
  listMine(userId: string) {
    return this.prisma.productQuestion.findMany({
      where: { userId },
      select: {
        id: true,
        question: true,
        answer: true,
        status: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- staff ----------

  async listForStaff(query: QuestionQueryDto) {
    const where: Prisma.ProductQuestionWhereInput = { status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.productQuestion.findMany({
        where,
        select: {
          id: true,
          question: true,
          answer: true,
          status: true,
          createdAt: true,
          answeredAt: true,
          product: { select: { id: true, name: true, slug: true } },
          user: { select: { name: true, email: true } },
          answeredBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.productQuestion.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Publishes the answer and lets the customer know by email. */
  async answer(id: string, staffId: string, dto: AnswerQuestionDto) {
    return this.prisma.$transaction(async (tx) => {
      const q = await tx.productQuestion
        .update({
          where: { id },
          data: {
            answer: dto.answer.trim(),
            status: QuestionStatus.PUBLISHED,
            answeredAt: new Date(),
            answeredById: staffId,
          },
          select: {
            id: true,
            status: true,
            question: true,
            answer: true,
            user: { select: { email: true, name: true } },
            product: { select: { name: true, slug: true } },
          },
        })
        .catch((e: unknown) => {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          )
            throw new NotFoundException('Question not found');
          throw e;
        });
      await this.mail.questionAnsweredEmail(
        tx,
        q.user,
        q.product,
        { question: q.question, answer: q.answer! },
        `${shopUrl()}/proizvod/${q.product.slug}#pitanja`,
      );
      return { id: q.id, status: q.status };
    });
  }

  async hide(id: string, staffId: string) {
    const { count } = await this.prisma.productQuestion.updateMany({
      where: { id },
      data: { status: QuestionStatus.HIDDEN, answeredById: staffId },
    });
    if (!count) throw new NotFoundException('Question not found');
    return { id, status: QuestionStatus.HIDDEN };
  }
}
