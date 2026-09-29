import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';
const toList = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.split(',').filter(Boolean)
    : Array.isArray(value)
      ? value
      : value;

export const PRODUCT_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'name',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  /** Several brands at once (comma-separated); combined with brandId if both are sent. */
  @IsOptional()
  @Transform(toList)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  brandIds?: string[];

  /** Exactly these products (comma-separated), e.g. the compare list or a guest's wishlist. */
  @IsOptional()
  @Transform(toList)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  ids?: string[];

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  onSale?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = 'newest';
}

export class AdminProductQueryDto extends ProductQueryDto {
  @IsOptional()
  @IsIn(['active', 'archived', 'all'])
  status: 'active' | 'archived' | 'all' = 'active';
}
