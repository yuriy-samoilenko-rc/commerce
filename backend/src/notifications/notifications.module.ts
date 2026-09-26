import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { StockAlertService } from './stock-alert.service';
import { WarrantyReminderService } from './warranty-reminder.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, StockAlertService, WarrantyReminderService],
  exports: [NotificationsService, StockAlertService],
})
export class NotificationsModule {}
