import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [StockModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
