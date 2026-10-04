import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { badRequest } from '../common/errors';
import { shopUrl } from '../common/shop-url';
import {
  PublicUser,
  publicUserSelect,
  UsersService,
} from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload';

const RESET_MINUTES = 60;
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// Compared against when the email is unknown, so a missing user costs the same
// time as a wrong password and response timing doesn't reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.users.create({ ...dto, role: Role.CUSTOMER });
    await this.audit.write({
      action: 'auth.register',
      entityType: 'users',
      entityId: user.id,
      statusCode: 201,
      userId: user.id,
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid || !user.isActive) {
      // Failed attempts are what an administrator looks for after a break-in attempt.
      await this.audit.write({
        action: 'auth.login_failed',
        entityType: 'users',
        entityId: user?.id ?? null,
        statusCode: 401,
        userId: user?.id ?? null,
        details: {
          email: dto.email,
          reason: !user
            ? 'unknown email'
            : !valid
              ? 'wrong password'
              : 'account deactivated',
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    const lastLoginAt = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt },
    });
    await this.audit.write({
      action: 'auth.login',
      entityType: 'users',
      entityId: user.id,
      statusCode: 200,
      userId: user.id,
    });
    const { passwordHash: _, ...rest } = user;
    const publicUser = { ...rest, lastLoginAt };
    return this.issueToken(publicUser);
  }

  /** A user edits their own name and, for customers, the contact data the shop prefills. */
  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        deliveryAddress:
          dto.deliveryAddress === undefined
            ? undefined
            : dto.deliveryAddress?.trim() || null,
      },
      select: publicUserSelect,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw badRequest('WRONG_PASSWORD', 'The current password is wrong');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
    });
    await this.audit.write({
      action: 'auth.password_changed',
      entityType: 'users',
      entityId: userId,
      statusCode: 200,
      userId,
    });
  }

  /**
   * Emails a one-time link for a new password. Unknown or deactivated emails get no
   * mail and the same answer; repeated requests within a minute are ignored.
   */
  async forgotPassword(email: string) {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user || !user.isActive) return;
    const recent = await this.prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    });
    if (recent) return;

    const token = randomBytes(32).toString('base64url');
    const link = `${shopUrl()}/nalog/nova-lozinka?token=${token}`;
    await this.prisma.$transaction(async (tx) => {
      // Only the newest link works.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000),
        },
      });
      await this.mail.passwordResetEmail(tx, user, link, RESET_MINUTES);
    });
    await this.audit.write({
      action: 'auth.password_reset_requested',
      entityType: 'users',
      entityId: user.id,
      statusCode: 204,
      userId: user.id,
    });
  }

  async resetPassword(dto: ResetPasswordDto) {
    const invalid = () =>
      badRequest('RESET_TOKEN_INVALID', 'The link is invalid, used or expired');
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { id: true, isActive: true } },
      },
    });
    if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.isActive)
      throw invalid();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.$transaction(async (tx) => {
      // Two requests with the same link: only the first one gets here.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!count) throw invalid();
      await tx.user.update({
        where: { id: row.user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
    });
    await this.audit.write({
      action: 'auth.password_reset',
      entityType: 'users',
      entityId: row.user.id,
      statusCode: 204,
      userId: row.user.id,
    });
  }

  private async issueToken(user: PublicUser) {
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}
