import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { conflict } from '../common/errors';
import { Prisma } from '../generated/prisma/client';

// Constraint names look like "products_sku_key" / "products_categoryId_fkey";
// the segment before the suffix is the column (columns are camelCase, no underscores).
function columnFromConstraint(e: Prisma.PrismaClientKnownRequestError): string | undefined {
  const index = (e.meta as any)?.driverAdapterError?.cause?.constraint?.index as string | undefined;
  const parts = index?.split('_');
  return parts && parts.length >= 3 ? parts[parts.length - 2] : undefined;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const column = columnFromConstraint(e);
    let mapped: HttpException | undefined;

    switch (e.code) {
      case 'P2002':
        mapped = conflict(
          'DUPLICATE',
          column ? `A record with this ${column} already exists` : 'Duplicate value',
          column ? { field: column } : undefined,
        );
        break;
      case 'P2025':
        mapped = new NotFoundException(`${e.meta?.modelName ?? 'Record'} not found`);
        break;
      case 'P2003':
        // Deletes check references up front, so an FK error here means a write pointed at a missing record.
        mapped = new BadRequestException(
          column ? `Referenced ${column} does not exist` : 'Referenced record does not exist',
        );
        break;
    }

    super.catch(mapped ?? e, host);
  }
}
