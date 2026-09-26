import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { WarehouseFilterDto } from './dto/fulfillment.dto';
import { FulfillmentService } from './fulfillment.service';

// The warehouse phone's "Picking" list (ТЗ п.34).
@Controller('admin/picking')
@Roles(...STAFF_ROLES)
export class PickingController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get()
  tasks(@Query() query: WarehouseFilterDto) {
    return this.fulfillment.pickingTasks(query.warehouseId);
  }
}
