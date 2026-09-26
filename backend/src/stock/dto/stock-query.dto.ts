import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StockMovementType } from '../../generated/prisma/client';

export class StockQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  // ?onlyAvailable=true hides rows where everything is reserved or sold out
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyAvailable?: boolean;
}

export class MovementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  receivingId?: string;

  @IsOptional()
  @IsUUID()
  transferId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}
