import { Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';

export class TransferItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity: number;

  // May be scanned gradually in the draft; must be complete before sending.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  serialNumbers?: string[];
}

export class CreateTransferDto {
  @IsUUID()
  fromWarehouseId: string;

  @IsUUID()
  toWarehouseId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}
