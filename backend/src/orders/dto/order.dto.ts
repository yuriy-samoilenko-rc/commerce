import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  DeliveryMethod,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../generated/prisma/client';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

/** Prices are never accepted from the client: the server reads them from the catalog. */
export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'customerPhone must be a phone number' })
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @ValidateIf((o: CheckoutDto) => o.deliveryMethod === DeliveryMethod.COURIER)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  deliveryAddress?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

/** An order a manager takes by phone or in the shop. */
export class ManualOrderDto extends CheckoutDto {
  /** Link to a registered customer account, if the buyer has one. */
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class CustomerCancelDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class StaffCancelDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  /** Order number, customer name, phone or email. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
