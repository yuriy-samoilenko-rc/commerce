import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { ReceivingsController } from './receivings.controller';
import { ReceivingsService } from './receivings.service';

@Module({
  imports: [StockModule],
  controllers: [ReceivingsController],
  providers: [ReceivingsService],
})
export class ReceivingsModule {}
