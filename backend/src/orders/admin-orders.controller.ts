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
import { ManualOrderDto, OrderQueryDto, StaffCancelDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

const ORDER_MANAGERS: Role[] = [Role.ADMIN, Role.MANAGER];

@Controller('admin/orders')
@Roles(...STAFF_ROLES)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

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
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.orders.confirm(id, user.id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT)
  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPaid(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
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
}
