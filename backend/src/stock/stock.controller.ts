import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto, StockQueryDto } from './dto/stock-query.dto';
import { StockService } from './stock.service';

@Controller()
@Roles(...STAFF_ROLES)
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('stock')
  listStock(@Query() query: StockQueryDto) {
    return this.stock.listStock(query);
  }

  @Get('stock/movements')
  listMovements(@Query() query: MovementQueryDto) {
    return this.stock.listMovements(query);
  }

  @Roles(Role.ADMIN)
  @Post('stock/adjustments')
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: PublicUser) {
    return this.stock.adjust(dto, user.id);
  }

  @Get('serials/:serialNumber')
  findSerial(@Param('serialNumber') serialNumber: string) {
    return this.stock.findSerial(serialNumber);
  }
}
