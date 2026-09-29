import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [CategoriesModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
