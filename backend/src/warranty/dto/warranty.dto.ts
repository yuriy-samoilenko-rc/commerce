import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { WarrantyStatus } from '../../generated/prisma/client';

export class CreateWarrantyCaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serialNumber: string;

  /** What the customer reports. */
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  problem: string;
}

export class SendToServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  serviceCenter: string;
}

export class WarrantyNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectWarrantyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note: string;
}

export class ReplaceUnitDto {
  /** Warehouse the replacement is taken from. */
  @IsUUID()
  warehouseId: string;

  /** Serial number of the new unit handed to the customer. */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serialNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class WarrantyQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(WarrantyStatus)
  status?: WarrantyStatus;
}
