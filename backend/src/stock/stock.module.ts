import { Module } from '@nestjs/common';
import { StockLedgerService } from './stock-ledger.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService, StockLedgerService],
  exports: [StockLedgerService, StockService],
})
export class StockModule {}
