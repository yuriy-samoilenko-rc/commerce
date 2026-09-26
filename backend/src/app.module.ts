import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { ReceivingsModule } from './receivings/receivings.module';
import { StockModule } from './stock/stock.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TransfersModule } from './transfers/transfers.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';

@Module({
  imports: [
    PrismaModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
