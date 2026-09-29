import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAX_PRICE = 99_999_999.99; // Decimal(10, 2)
const money = { maxDecimalPlaces: 2 };

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  trackSerial?: boolean;

  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  purchasePrice: number;

  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  sellingPrice: number;

  @IsOptional()
  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  discountPrice?: number | null;

  /** When the sale ends; null = no end date. Only meaningful with a discountPrice. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  discountEndsAt?: Date | null;

  @IsOptional()
  @IsNumber(money)
  @Min(0)
  @Max(100)
  vatPercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9_999_999)
  weightKg?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths?: number | null;

  /** "Low stock" alert level for this product; empty = company default. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold?: number | null;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;
}
