import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import {
  CompanySettingsService,
  UpdateCompanySettingsDto,
} from './company-settings.service';

@Controller('admin/settings')
@Roles(...STAFF_ROLES)
export class SettingsController {
  constructor(private readonly company: CompanySettingsService) {}

  @Get('company')
  getCompany() {
    return this.company.get();
  }

  // Only affects documents issued from now on: issued documents keep their snapshot.
  @Roles(Role.ADMIN)
  @Patch('company')
  updateCompany(@Body() dto: UpdateCompanySettingsDto) {
    return this.company.update(dto);
  }
}
