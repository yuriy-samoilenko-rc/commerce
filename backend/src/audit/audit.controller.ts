import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Exact action ("orders.confirm") or a prefix ending with a dot ("orders."). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

// ТЗ UI п.25: "критически важный экран" — only the administrator reads it.
@Controller('admin/audit-log')
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      userId: q.userId,
      entityType: q.entityType,
      entityId: q.entityId,
      action: q.action?.endsWith('.') ? { startsWith: q.action } : q.action,
      createdAt: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }
}
