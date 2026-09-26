import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TransferStatus } from '../../generated/prisma/client';

export class TransferQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @IsOptional()
  @IsUUID()
  fromWarehouseId?: string;

  @IsOptional()
  @IsUUID()
  toWarehouseId?: string;
}
