import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPerson?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /** Žiro račun */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccount?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contractNumber?: string | null;

  /** Last day the purchase contract is valid, YYYY-MM-DD */
  @IsOptional()
  @IsDateString({ strict: true })
  contractUntil?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
