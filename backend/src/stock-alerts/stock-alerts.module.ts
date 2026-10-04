import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { StockAlertNotifier } from './stock-alert-notifier.service';
import { StockAlertDto, StockAlertsService } from './stock-alerts.service';

@Public()
@Controller('products/:id/stock-alerts')
export class StockAlertsController {
  constructor(private readonly alerts: StockAlertsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  subscribe(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockAlertDto,
  ) {
    return this.alerts.subscribe(id, dto.email);
  }
}

@Module({
  controllers: [StockAlertsController],
  providers: [StockAlertsService, StockAlertNotifier],
  exports: [StockAlertsService],
})
export class StockAlertsModule {}
