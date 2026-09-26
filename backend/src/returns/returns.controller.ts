import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { StaffCreateReturnDto } from './dto/return.dto';
import { ReturnsService } from './returns.service';

// Customer side: request a return for a delivered order of their own.
@Controller('returns')
@Roles(Role.CUSTOMER)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  create(@Body() dto: StaffCreateReturnDto, @CurrentUser() user: PublicUser) {
    const { orderId, ...rest } = dto;
    return this.returns.create(orderId, rest, { id: user.id, customer: true });
  }

  @Get()
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: PublicUser) {
    return this.returns.listForCustomer(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.returns.findForCustomer(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.returns.cancel(id, { id: user.id, customer: true });
  }
}
