import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuditService } from '../../audit/audit.service';
import { describeRoute } from '../../audit/describe-route';
import { Role } from '../../generated/prisma/client';
import { PublicUser } from '../../users/users.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: PublicUser }>();
    const user = req.user;
    if (!user || !required.includes(user.role)) {
      const { path } = describeRoute(req);
      void this.audit.write({
        action: 'access.denied',
        statusCode: 403,
        details: { route: `${req.method} ${path}`, role: user?.role, required },
      });
      throw new ForbiddenException();
    }
    return true;
  }
}
