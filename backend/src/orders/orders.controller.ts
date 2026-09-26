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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { CheckoutDto, CustomerCancelDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

// The online shop: a logged-in customer sees and manages only their own orders.
@Controller('orders')
@Roles(Role.CUSTOMER)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: PublicUser) {
    return this.orders.placeOnline(dto, user);
  }

  @Get()
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: PublicUser) {
    return this.orders.listForCustomer(user.id, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.orders.findForCustomer(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerCancelDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.orders.cancelByCustomer(id, user.id, dto.reason);
  }
}
