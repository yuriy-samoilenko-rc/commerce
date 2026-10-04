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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MoveToQueryDto } from '../common/dto/move-to-query.dto';
import { Role } from '../generated/prisma/client';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Public()
  @Get()
  findAll() {
    return this.brands.findAll();
  }

  /** With product counts, for the admin's catalog screen. */
  @Roles(Role.ADMIN)
  @Get('manage')
  manage() {
    return this.brands.manageList();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brands.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Query() q: MoveToQueryDto) {
    return this.brands.remove(id, q.moveTo);
  }
}
