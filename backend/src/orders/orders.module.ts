import { Module } from '@nestjs/common';
import { PromoModule } from '../promo/promo.module';
import { StockModule } from '../stock/stock.module';
import { AdminOrdersController } from './admin-orders.controller';
import { FulfillmentService } from './fulfillment.service';
import { OrderExpiryService } from './order-expiry.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PickingController } from './picking.controller';

@Module({
  imports: [StockModule, PromoModule],
  controllers: [OrdersController, AdminOrdersController, PickingController],
  providers: [OrdersService, FulfillmentService, OrderExpiryService],
})
export class OrdersModule {}
