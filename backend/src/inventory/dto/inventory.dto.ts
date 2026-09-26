import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InventoryStatus } from '../../generated/prisma/client';

export class CreateCountDto {
  @IsUUID()
  warehouseId: string;

  /** Count only this category (with subcategories); omit to count the whole warehouse. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ScanDto {
  /** Whatever the scanner read: barcode, SKU or serial number. */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code: string;

  /** For non-serial goods: how many identical units this scan represents. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity?: number;
}

/** Overwrites what was counted for one product (manual entry or correcting a mis-scan). */
export class SetLineDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  countedQuantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  serialNumbers?: string[];
}

export class CountQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
