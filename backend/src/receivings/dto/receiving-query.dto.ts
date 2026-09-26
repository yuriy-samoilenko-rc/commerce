import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReceivingStatus } from '../../generated/prisma/client';

export class ReceivingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReceivingStatus)
  status?: ReceivingStatus;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
