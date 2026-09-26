import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { CreateReceivingDto } from './dto/create-receiving.dto';
import { ReceivingQueryDto } from './dto/receiving-query.dto';
import { UpdateReceivingDto } from './dto/update-receiving.dto';
import { ReceivingsService } from './receivings.service';

const RECEIVING_EDITORS: Role[] = [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE];

@Controller('receivings')
@Roles(...STAFF_ROLES)
export class ReceivingsController {
  constructor(private readonly receivings: ReceivingsService) {}

  @Get()
  list(@Query() query: ReceivingQueryDto) {
    return this.receivings.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.receivings.findOne(id);
  }

  @Roles(...RECEIVING_EDITORS)
  @Post()
  create(@Body() dto: CreateReceivingDto, @CurrentUser() user: PublicUser) {
    return this.receivings.create(dto, user.id);
  }

  @Roles(...RECEIVING_EDITORS)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReceivingDto) {
    return this.receivings.update(id, dto);
  }

  @Roles(...RECEIVING_EDITORS)
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.receivings.confirm(id, user.id);
  }

  @Roles(...RECEIVING_EDITORS)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.receivings.cancel(id);
  }
}
