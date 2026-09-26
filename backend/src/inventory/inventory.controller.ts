import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { CountQueryDto, CreateCountDto, ScanDto, SetLineDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

const COUNTERS: Role[] = [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE];

@Controller('inventory-counts')
@Roles(...STAFF_ROLES)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() query: CountQueryDto) {
    return this.inventory.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.findOne(id);
  }

  @Roles(...COUNTERS)
  @Post()
  create(@Body() dto: CreateCountDto, @CurrentUser() user: PublicUser) {
    return this.inventory.create(dto, user.id);
  }

  @Roles(...COUNTERS)
  @Post(':id/scan')
  @HttpCode(HttpStatus.OK)
  scan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ScanDto) {
    return this.inventory.scan(id, dto);
  }

  @Roles(...COUNTERS)
  @Put(':id/lines/:productId')
  setLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetLineDto,
  ) {
    return this.inventory.setLine(id, productId, dto);
  }

  @Roles(...COUNTERS)
  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  finish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.inventory.finish(id, user.id);
  }

  // Reviewing differences and booking them is the administrator's decision (ТЗ п.14).
  @Roles(Role.ADMIN)
  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.reopen(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.inventory.approve(id, user.id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.cancel(id);
  }
}
