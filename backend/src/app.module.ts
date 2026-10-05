import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { DocumentsModule } from './documents/documents.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ShopModule } from './shop/shop.module';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module';
import { PromoModule } from './promo/promo.module';
import { BannersModule } from './banners/banners.module';
import { QuestionsModule } from './questions/questions.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { ReceivingsModule } from './receivings/receivings.module';
import { ReportsModule } from './reports/reports.module';
import { ReturnsModule } from './returns/returns.module';
import { SettingsModule } from './settings/settings.module';
import { StockModule } from './stock/stock.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TransfersModule } from './transfers/transfers.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { WarrantyModule } from './warranty/warranty.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    SettingsModule,
    DocumentsModule,
    NotificationsModule,
    MailModule,
    MediaModule,
    ReportsModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    WarehousesModule,
    SuppliersModule,
    StockModule,
    ReceivingsModule,
    TransfersModule,
    InventoryModule,
    OrdersModule,
    ReturnsModule,
    WarrantyModule,
    ShopModule,
    ReviewsModule,
    WishlistModule,
    StockAlertsModule,
    PromoModule,
    BannersModule,
    QuestionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
