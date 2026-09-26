import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { StockModule } from '../stock/stock.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [StockModule, CategoriesModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
