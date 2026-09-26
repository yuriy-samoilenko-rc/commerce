import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReceivingItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  purchasePrice: number;

  // May be filled gradually while the receiving is a draft; must be complete to confirm.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  serialNumbers?: string[];
}

export class CreateReceivingDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierDocNumber?: string | null;

  /** Date on the supplier's invoice, YYYY-MM-DD */
  @IsOptional()
  @IsDateString({ strict: true })
  supplierDocDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReceivingItemDto)
  items: ReceivingItemDto[];
}
