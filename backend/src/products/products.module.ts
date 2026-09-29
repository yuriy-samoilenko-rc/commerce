import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { AdminProductsController } from './admin-products.controller';
import { ProductImagesController } from './product-images.controller';
import { ProductImagesService } from './product-images.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SaleExpiryService } from './sale-expiry.service';

@Module({
  imports: [CategoriesModule],
  controllers: [
    ProductsController,
    AdminProductsController,
    ProductImagesController,
  ],
  providers: [ProductsService, ProductImagesService, SaleExpiryService],
  exports: [ProductsService],
})
export class ProductsModule {}
