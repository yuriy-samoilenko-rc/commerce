import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FieldChange, requestContext } from './request-context';

export interface AuditEntry {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  statusCode?: number | null;
  changes?: Record<string, FieldChange> | null;
  details?: Record<string, unknown> | null;
  /** Defaults to the user of the current request. */
  userId?: string | null;
}

const SENSITIVE = /password|token|secret|authorization/i;
const MAX_DETAILS_CHARS = 10_000;

/** Removes credentials from anything that goes into the audit trail. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SENSITIVE.test(k) ? '[redacted]' : redact(v),
      ]),
    );
  }
  return value;
}

function comparable(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
) {
  const changes: Record<string, FieldChange> = {};
  for (const key of keys) {
    const from = comparable(before[key]);
    const to = comparable(after[key]);
    if (from !== to) changes[key] = { from, to };
  }
  return changes;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs an update and remembers which of `keys` actually changed, so the request's
   * audit entry shows e.g. sellingPrice 699 → 649.
   */
  async trackUpdate<T>(
    load: () => Promise<Record<string, unknown> | null>,
    update: () => Promise<T>,
    keys: string[],
  ): Promise<T> {
    const before = await load();
    const result = await update();
    const after = await load();
    if (before && after) {
      const ctx = requestContext.getStore();
      if (ctx) Object.assign(ctx.changes, diffFields(before, after, keys));
    }
    return result;
  }

  /** Never throws: a failing audit write must not break the business operation. */
  async write(entry: AuditEntry) {
    const req = requestContext.getStore()?.req;
    try {
      let details = entry.details ? redact(entry.details) : null;
      if (details && JSON.stringify(details).length > MAX_DETAILS_CHARS) {
        details = {
          truncated: true,
          route: (entry.details as { route?: string }).route,
        };
      }
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          statusCode: entry.statusCode ?? null,
          changes:
            entry.changes && Object.keys(entry.changes).length
              ? (entry.changes as unknown as Prisma.InputJsonObject)
              : Prisma.DbNull,
          details: details
            ? (details as Prisma.InputJsonObject)
            : Prisma.DbNull,
          userId:
            entry.userId !== undefined ? entry.userId : (userOf(req) ?? null),
          ip: req?.ip ?? null,
          userAgent: req?.headers['user-agent']?.slice(0, 300) ?? null,
        },
      });
    } catch (e) {
      this.logger.error(
        `Could not write audit entry ${entry.action}`,
        e instanceof Error ? e.stack : e,
      );
    }
  }
}

export function userOf(req?: Request): string | undefined {
  return (req as (Request & { user?: { id: string } }) | undefined)?.user?.id;
}

/** The fields a PATCH body actually sets (undefined = not sent). */
export const changedKeys = (dto: object) =>
  Object.entries(dto)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);
