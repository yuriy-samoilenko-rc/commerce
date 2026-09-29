import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { badRequest } from '../common/errors';
import {
  PublicUser,
  publicUserSelect,
  UsersService,
} from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload';

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

  private async issueToken(user: PublicUser) {
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}
