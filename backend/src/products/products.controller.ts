import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';

// Online shop catalog.
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.products.listPublic(query);
  }

  @Get('sitemap')
  sitemap() {
    return this.products.sitemap();
  }

  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.products.findPublicBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findPublic(id);
  }

  @Get(':id/recommendations')
  recommendations(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.recommendations(id);
  }
}
