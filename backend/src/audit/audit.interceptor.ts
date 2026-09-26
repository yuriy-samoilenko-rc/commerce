import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { describeRoute } from './describe-route';
import { requestContext } from './request-context';
import { SKIP_AUDIT } from './skip-audit.decorator';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes one audit entry for every request that changes something, successful or not.
 * Being global, it covers every current and future endpoint without extra code.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const targets = [context.getHandler(), context.getClass()];
    if (
      !MUTATING.has(req.method) ||
      this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT, targets)
    ) {
      return next.handle();
    }

    const started = Date.now();
    const successStatus =
      this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler()) ??
      (req.method === 'POST' ? 201 : 200);

    const log = (
      statusCode: number,
      responseBody?: unknown,
      error?: unknown,
    ) => {
      const { path, entityType, action } = describeRoute(req);
      const createdId = (responseBody as { id?: unknown } | undefined)?.id;
      const paramId = req.params?.id;
      void this.audit.write({
        action,
        entityType,
        entityId:
          typeof paramId === 'string'
            ? paramId
            : typeof createdId === 'string'
              ? createdId
              : null,
        statusCode,
        changes: requestContext.getStore()?.changes,
        details: {
          route: `${req.method} ${path}`,
          params: req.params,
          body: req.body,
          durationMs: Date.now() - started,
          ...(error !== undefined && { error: errorMessage(error) }),
        },
      });
    };

    return next.handle().pipe(
      tap((body) => log(successStatus, body)),
      catchError((err: unknown) => {
        log(
          err instanceof HttpException ? err.getStatus() : 500,
          undefined,
          err,
        );
        throw err;
      }),
    );
  }
}

function errorMessage(err: unknown) {
  if (err instanceof HttpException) {
    const response = err.getResponse();
    return typeof response === 'string'
      ? response
      : (response as { message?: unknown }).message;
  }
  return err instanceof Error ? err.message : String(err);
}
