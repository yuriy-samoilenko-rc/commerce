import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { PickDto, ShipDto, WarehouseFilterDto } from './dto/fulfillment.dto';
import { ManualOrderDto, OrderQueryDto, StaffCancelDto } from './dto/order.dto';
import { FulfillmentService } from './fulfillment.service';
import { OrdersService } from './orders.service';

const ORDER_MANAGERS: Role[] = [Role.ADMIN, Role.MANAGER];
const WAREHOUSE_STAFF: Role[] = [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE];

@Controller('admin/orders')
@Roles(...STAFF_ROLES)
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.orders.listForStaff(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findForStaff(id);
  }

  @Roles(...ORDER_MANAGERS)
  @Post()
  create(@Body() dto: ManualOrderDto, @CurrentUser() user: PublicUser) {
    return this.orders.placeManual(dto, user.id);
  }

  @Roles(...ORDER_MANAGERS)
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.orders.confirm(id, user.id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT)
  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.orders.markPaid(id, user.id);
  }

  @Roles(...ORDER_MANAGERS)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffCancelDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.orders.cancelByStaff(id, user.id, dto.reason);
  }

  // ---------- fulfillment ----------

  @Roles(...ORDER_MANAGERS)
  @Post(':id/start-picking')
  @HttpCode(HttpStatus.OK)
  startPicking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.fulfillment.startPicking(id, user.id);
  }

  @Get(':id/pick-sheet')
  pickSheet(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: WarehouseFilterDto,
  ) {
    return this.fulfillment.pickSheet(id, query.warehouseId);
  }

  @Roles(...WAREHOUSE_STAFF)
  @Post(':id/pick')
  @HttpCode(HttpStatus.OK)
  pick(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PickDto) {
    return this.fulfillment.pick(id, dto);
  }

  @Roles(...WAREHOUSE_STAFF)
  @Post(':id/unpick')
  @HttpCode(HttpStatus.OK)
  unpick(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PickDto) {
    return this.fulfillment.unpick(id, dto);
  }

  @Roles(...WAREHOUSE_STAFF)
  @Post(':id/complete-picking')
  @HttpCode(HttpStatus.OK)
  completePicking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.fulfillment.completePicking(id, user.id);
  }

  @Roles(...WAREHOUSE_STAFF)
  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  ship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.fulfillment.ship(id, dto, user.id);
  }

  @Roles(...WAREHOUSE_STAFF)
  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.fulfillment.deliver(id, user.id);
  }

  @Roles(...ORDER_MANAGERS)
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.fulfillment.complete(id, user.id);
  }
}
