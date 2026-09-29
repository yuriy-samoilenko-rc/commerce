import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuditService, changedKeys } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Tx } from '../stock/stock-ledger.service';

export class UpdateCompanySettingsDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(300) legalName?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(50) taxId?: string | null;
  @IsOptional() @IsString() @MaxLength(50) registrationNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(100) bankAccount?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() @MaxLength(200) website?: string | null;

  /** ISO 4217 code, e.g. EUR, RSD */
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultVatPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold?: number;

  /** Courier delivery price. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000)
  courierFee?: number;

  /** Courier delivery is free from this order value (goods only); null = never free. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  freeShippingFrom?: number | null;
}

const ID = 1;

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Plain read, safe inside any transaction. (An upsert would lock the single settings
   * row until commit and make every stock/document transaction wait for each other.)
   * The migration creates the row; ensureRow() covers a freshly reset database.
   */
  async get(db: Tx | PrismaService = this.prisma) {
    return (
      (await db.companySettings.findUnique({ where: { id: ID } })) ??
      this.ensureRow()
    );
  }

  private ensureRow() {
    return this.prisma.companySettings.upsert({
      where: { id: ID },
      create: { id: ID },
      update: {},
    });
  }

  async update(dto: UpdateCompanySettingsDto) {
    await this.ensureRow();
    return this.audit.trackUpdate(
      () => this.prisma.companySettings.findUnique({ where: { id: ID } }),
      () =>
        this.prisma.companySettings.update({ where: { id: ID }, data: dto }),
      changedKeys(dto),
    );
  }
}
