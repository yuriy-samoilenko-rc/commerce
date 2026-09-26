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
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { TransfersService } from './transfers.service';

const OPERATORS: Role[] = [Role.ADMIN, Role.MANAGER, Role.WAREHOUSE];

@Controller('transfers')
@Roles(...STAFF_ROLES)
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  list(@Query() query: TransferQueryDto) {
    return this.transfers.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.findOne(id);
  }

  @Roles(...OPERATORS)
  @Post()
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: PublicUser) {
    return this.transfers.create(dto, user.id);
  }

  @Roles(...OPERATORS)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTransferDto) {
    return this.transfers.update(id, dto);
  }

  @Roles(...OPERATORS)
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.transfers.send(id, user.id);
  }

  @Roles(...OPERATORS)
  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.transfers.receive(id, user.id);
  }

  @Roles(...OPERATORS)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.cancel(id);
  }
}
