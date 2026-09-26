import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReturnDecision, ReturnReason, ReturnStatus } from '../../generated/prisma/client';

export class ReturnLineDto {
  @IsUUID()
  orderItemId: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  /** Required for serial-tracked goods: exactly which units come back. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  serialNumbers?: string[];

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonNote?: string;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items: ReturnLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class StaffCreateReturnDto extends CreateReturnDto {
  @IsUUID()
  orderId: string;
}

export class ReceiveReturnDto {
  @IsUUID()
  warehouseId: string;
}

export class LineDecisionDto {
  @IsUUID()
  itemId: string;

  @IsEnum(ReturnDecision)
  decision: ReturnDecision;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class DecideReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LineDecisionDto)
  items: LineDecisionDto[];
}

export class RefundDto {
  /** Bank transfer id, card refund id, cash receipt number... */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}

export class ReturnQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
