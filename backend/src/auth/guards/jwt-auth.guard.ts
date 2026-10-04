import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../../users/users.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../jwt-payload';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    // Loading the user on every request makes deactivation and role changes take
    // effect immediately instead of waiting for the token to expire.
    const found = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...publicUserSelect, passwordChangedAt: true },
    });
    if (!found || !found.isActive) throw new UnauthorizedException();
    // A password reset ends every session that existed before it.
    const { passwordChangedAt, ...user } = found;
    if (
      passwordChangedAt &&
      (payload.iat ?? 0) * 1000 + 999 < passwordChangedAt.getTime()
    ) {
      throw new UnauthorizedException();
    }

    request['user'] = user;
    return true;
  }
}
