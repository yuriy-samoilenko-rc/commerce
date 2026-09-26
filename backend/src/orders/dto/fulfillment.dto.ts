import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PickDto {
  /** What the scanner read: barcode, SKU or serial number. */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code: string;

  /** The warehouse the picker is standing in. */
  @IsUUID()
  warehouseId: string;

  /** For non-serial goods: several identical units in one scan. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;
}

export class ShipDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}

export class WarehouseFilterDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
