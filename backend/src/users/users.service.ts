import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '../generated/prisma/client';
import { AuditService, changedKeys } from '../audit/audit.service';
import { badRequest } from '../common/errors';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { PrismaService } from '../prisma/prisma.service';

// passwordHash never leaves the service: every read goes through this select.
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  phone: true,
  deliveryAddress: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(data: {
    email: string;
    password: string;
    name: string;
    role?: Role;
  }): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role,
        passwordHash,
      },
      select: publicUserSelect,
    });
  }

  /** Employees only; customer accounts have their own list (`listCustomers`). */
  findAll(): Promise<PublicUser[]> {
    return this.prisma.user.findMany({
      where: { role: { not: Role.CUSTOMER } },
      select: publicUserSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Customer accounts with the contact details of their latest order: users have no
   * phone or address of their own, so that is where a manager finds them.
   */
  async listCustomers(q: CustomerQueryDto) {
    const where: Prisma.UserWhereInput = { role: Role.CUSTOMER };
    const search = q.search?.trim();
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.OR = [{ name: contains }, { email: contains }];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
          ordersPlaced: {
            select: { customerPhone: true, deliveryAddress: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { ordersPlaced: true } },
        },
        orderBy: { name: 'asc' },
        ...pageArgs(q),
      }),
      this.prisma.user.count({ where }),
    ]);
    const items = rows.map(({ ordersPlaced, _count, ...c }) => ({
      ...c,
      phone: ordersPlaced[0]?.customerPhone ?? null,
      address: ordersPlaced[0]?.deliveryAddress ?? null,
      orderCount: _count.ordersPlaced,
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * `actorId` is the admin making the change: they cannot lock themselves out
   * (deactivate or demote their own account), which also keeps at least one
   * active admin. Customer and employee accounts do not turn into each other.
   */
  async update(
    id: string,
    dto: { name?: string; role?: Role; isActive?: boolean; password?: string },
    actorId?: string,
  ): Promise<PublicUser> {
    const current = await this.findById(id);
    if (
      id === actorId &&
      (dto.isActive === false ||
        (dto.role !== undefined && dto.role !== Role.ADMIN))
    ) {
      throw badRequest(
        'OWN_ACCOUNT',
        'You cannot deactivate or demote your own account',
      );
    }
    if (
      dto.role !== undefined &&
      (dto.role === Role.CUSTOMER) !== (current.role === Role.CUSTOMER)
    ) {
      throw badRequest(
        'STAFF_ROLE',
        'Customer and employee accounts cannot be converted',
      );
    }
    const { password, ...data } = dto;
    const keys = changedKeys(data);
    const changes: Prisma.UserUpdateInput = { ...data };
    if (password !== undefined) {
      changes.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      changes.passwordChangedAt = new Date();
      keys.push('passwordChangedAt');
    }
    return this.audit.trackUpdate(
      () =>
        this.prisma.user.findUnique({
          where: { id },
          select: { ...publicUserSelect, passwordChangedAt: true },
        }),
      () =>
        this.prisma.user.update({
          where: { id },
          data: changes,
          select: publicUserSelect,
        }),
      keys,
    );
  }
}
