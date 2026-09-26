import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import type { ExportFormat } from '../report';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class PeriodQueryDto {
  /** First day, YYYY-MM-DD in local time (default: 29 days before `to`). */
  @IsOptional()
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  /** Last day, inclusive (default: today). */
  @IsOptional()
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx', 'pdf'])
  format: ExportFormat = 'json';
}

export const SALES_GROUPS = [
  'day',
  'week',
  'month',
  'year',
  'product',
  'category',
  'employee',
] as const;
export type SalesGroup = (typeof SALES_GROUPS)[number];

export class SalesQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsIn(SALES_GROUPS)
  groupBy: SalesGroup = 'day';
}

export class StockReportQueryDto {
  @IsOptional() @IsUUID() warehouseId?: string;

  /** Includes its subcategories. */
  @IsOptional() @IsUUID() categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyLow?: boolean;

  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx', 'pdf'])
  format: ExportFormat = 'json';
}

export class MovementsReportQueryDto extends PeriodQueryDto {
  @IsOptional() @IsUUID() warehouseId?: string;
}
