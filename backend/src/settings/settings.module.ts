import { Global, Module } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';
import { SettingsController } from './settings.controller';

@Global()
@Module({
  controllers: [SettingsController],
  providers: [CompanySettingsService],
  exports: [CompanySettingsService],
})
export class SettingsModule {}
