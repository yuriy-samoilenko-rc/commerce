import { Controller, Get, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { ShopService } from './shop.service';

export class FacetsQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onSale?: boolean;
}

export class SuggestQueryDto {
  @IsString()
  @MaxLength(100)
  q: string;
}

@Public()
@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  /** Contacts, delivery prices and pickup points. */
  @Get()
  info() {
    return this.shop.info();
  }

  @Get('categories')
  categories() {
    return this.shop.categories();
  }

  @Get('suggest')
  suggest(@Query() query: SuggestQueryDto) {
    return this.shop.suggest(query.q);
  }

  @Get('facets')
  facets(@Query() query: FacetsQueryDto) {
    return this.shop.facets(query);
  }
}
