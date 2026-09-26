import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { localIsoDate } from '../common/timezone';
import { Role } from '../generated/prisma/client';
import { CompanySettingsService } from '../settings/company-settings.service';
import { DashboardService } from './dashboard.service';
import {
  MovementsReportQueryDto,
  PeriodQueryDto,
  SalesQueryDto,
  StockReportQueryDto,
} from './dto/report-query.dto';
import {
  EXPORT_TYPES,
  ExportFormat,
  Report,
  toCsv,
  toPdf,
  toXlsx,
} from './report';
import { ReportsService } from './reports.service';

// Money figures are for management and accounting; warehouse staff see stock reports only.
const FINANCE: Role[] = [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT];

@Controller('admin')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly dashboard: DashboardService,
    private readonly company: CompanySettingsService,
  ) {}

  @Roles(...FINANCE)
  @Get('dashboard')
  overview() {
    return this.dashboard.overview();
  }

  @Roles(...FINANCE)
  @Get('reports/sales')
  async sales(
    @Query() q: SalesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.reports.sales(q),
      q.format,
      `prodaja-${q.groupBy}`,
    );
  }

  @Roles(...FINANCE)
  @Get('reports/customers')
  async customers(
    @Query() q: PeriodQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.reports.customers(q), q.format, 'kupci');
  }

  @Roles(...FINANCE)
  @Get('reports/suppliers')
  async suppliers(
    @Query() q: PeriodQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.reports.suppliers(q),
      q.format,
      'dobavljaci',
    );
  }

  @Roles(...STAFF_ROLES)
  @Get('reports/stock')
  async stock(
    @Query() q: StockReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.reports.stock(q), q.format, 'zalihe');
  }

  @Roles(...STAFF_ROLES)
  @Get('reports/movements')
  async movements(
    @Query() q: MovementsReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.reports.movements(q),
      q.format,
      'kretanje-robe',
    );
  }

  private async send(
    res: Response,
    report: Report,
    format: ExportFormat,
    name: string,
  ) {
    if (format === 'json') return report;
    const buffer =
      format === 'csv'
        ? toCsv(report)
        : format === 'xlsx'
          ? await toXlsx(report)
          : await toPdf(report, await this.company.get());
    const { contentType, extension } = EXPORT_TYPES[format];
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${name}-${localIsoDate()}.${extension}"`,
    });
    return new StreamableFile(buffer);
  }
}
