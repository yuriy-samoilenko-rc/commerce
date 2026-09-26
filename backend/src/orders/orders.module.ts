import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderExpiryService } from './order-expiry.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [StockModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderExpiryService],
})
export class OrdersModule {}
