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
import {
  CreateWarrantyCaseDto,
  RejectWarrantyDto,
  ReplaceUnitDto,
  SendToServiceDto,
  WarrantyNoteDto,
  WarrantyQueryDto,
} from './dto/warranty.dto';
import { WarrantyService } from './warranty.service';

const HANDLERS: Role[] = [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE];

@Controller('admin/warranty-cases')
@Roles(...STAFF_ROLES)
export class WarrantyController {
  constructor(private readonly warranty: WarrantyService) {}

  @Get()
  list(@Query() query: WarrantyQueryDto) {
    return this.warranty.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.warranty.findOne(id);
  }

  @Roles(...HANDLERS)
  @Post()
  create(@Body() dto: CreateWarrantyCaseDto, @CurrentUser() user: PublicUser) {
    return this.warranty.create(dto, user.id);
  }

  @Roles(...HANDLERS)
  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@Param('id', ParseUUIDPipe) id: string) {
    return this.warranty.receive(id);
  }

  @Roles(...HANDLERS)
  @Post(':id/send-to-service')
  @HttpCode(HttpStatus.OK)
  sendToService(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendToServiceDto) {
    return this.warranty.sendToService(id, dto.serviceCenter);
  }

  @Roles(...HANDLERS)
  @Post(':id/repair-completed')
  @HttpCode(HttpStatus.OK)
  repairCompleted(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WarrantyNoteDto) {
    return this.warranty.repairCompleted(id, dto.note);
  }

  @Roles(...HANDLERS)
  @Post(':id/return-to-customer')
  @HttpCode(HttpStatus.OK)
  returnToCustomer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WarrantyNoteDto) {
    return this.warranty.returnToCustomer(id, dto.note);
  }

  // Giving away a new unit or refusing a claim are a manager's call.
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/replace')
  @HttpCode(HttpStatus.OK)
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceUnitDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.warranty.replace(id, dto, user.id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectWarrantyDto) {
    return this.warranty.reject(id, dto.note);
  }
}
