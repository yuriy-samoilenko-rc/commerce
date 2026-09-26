import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  warehouseId: string;

  @IsUUID()
  productId: string;

  /** Signed change: +3 found extra units, -2 damaged / lost. */
  @IsInt()
  @NotEquals(0)
  @Min(-100_000)
  @Max(100_000)
  quantity: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  serialNumbers?: string[];
}
