import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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
