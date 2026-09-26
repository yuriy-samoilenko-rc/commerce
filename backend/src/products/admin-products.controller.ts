import {
  Body,
  Controller,
  Delete,
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
import { CreateProductDto } from './dto/create-product.dto';
import { AdminProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const COST_VIEWERS: Role[] = [Role.ADMIN, Role.ACCOUNTANT];
const canSeeCost = (user: PublicUser) => COST_VIEWERS.includes(user.role);

@Controller('admin/products')
@Roles(...STAFF_ROLES)
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: AdminProductQueryDto, @CurrentUser() user: PublicUser) {
    return this.products.listStaff(query, canSeeCost(user));
  }

  @Get('by-barcode/:code')
  findByCode(@Param('code') code: string, @CurrentUser() user: PublicUser) {
    return this.products.findByCode(code, canSeeCost(user));
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) {
    return this.products.findStaff(id, canSeeCost(user));
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  // Products are never physically deleted: orders and documents keep referring to them.
  @Roles(Role.ADMIN)
  @Delete(':id')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.setArchived(id, true);
  }

  @Roles(Role.ADMIN)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.setArchived(id, false);
  }
}
