import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEmail,
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
}

const ID = 1;

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The migration creates the row; upsert keeps a freshly reset database working too. */
  get(db: Tx | PrismaService = this.prisma) {
    return db.companySettings.upsert({
      where: { id: ID },
      create: { id: ID },
      update: {},
    });
  }

  async update(dto: UpdateCompanySettingsDto) {
    await this.get();
    return this.audit.trackUpdate(
      () => this.prisma.companySettings.findUnique({ where: { id: ID } }),
      () =>
        this.prisma.companySettings.update({ where: { id: ID }, data: dto }),
      changedKeys(dto),
    );
  }
}
