import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import {
  DecideReturnDto,
  ReceiveReturnDto,
  RefundDto,
  ReturnQueryDto,
  StaffCreateReturnDto,
} from './dto/return.dto';
import { ReturnsService } from './returns.service';

const HANDLERS: Role[] = [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE];

@Controller('admin/returns')
@Roles(...STAFF_ROLES)
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list(@Query() query: ReturnQueryDto) {
    return this.returns.listForStaff(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.returns.findForStaff(id);
  }

  @Roles(...HANDLERS)
  @Post()
  create(@Body() dto: StaffCreateReturnDto, @CurrentUser() user: PublicUser) {
    const { orderId, ...rest } = dto;
    return this.returns.create(orderId, rest, { id: user.id, customer: false });
  }

  @Roles(...HANDLERS)
  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveReturnDto, @CurrentUser() user: PublicUser) {
    return this.returns.receive(id, dto.warehouseId, user.id);
  }

  @Roles(...HANDLERS)
  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideReturnDto) {
    return this.returns.decide(id, dto);
  }

  // Approving commits money and stock, so it is a manager's call.
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.returns.approve(id, user.id);
  }

  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundDto, @CurrentUser() user: PublicUser) {
    return this.returns.refund(id, dto, user.id);
  }

  @Roles(...HANDLERS)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.returns.cancel(id, { id: user.id, customer: false });
  }
}
