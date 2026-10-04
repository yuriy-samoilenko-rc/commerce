import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import {
  CreatePromoCodeDto,
  PromoCodesService,
  PromoQuoteDto,
} from './promo-codes.service';

class UpdatePromoCodeDto extends PartialType(CreatePromoCodeDto, {
  skipNullProperties: false,
}) {}

@Public()
@Controller('shop/promo')
export class PromoQuoteController {
  constructor(private readonly promo: PromoCodesService) {}

  /** Checks a code against the cart; the order checks it again when it is placed. */
  @Post()
  @HttpCode(HttpStatus.OK)
  quote(@Body() dto: PromoQuoteDto) {
    return this.promo.quote(dto);
  }
}

@Controller('admin/promo-codes')
@Roles(Role.ADMIN, Role.MANAGER)
export class AdminPromoCodesController {
  constructor(private readonly promo: PromoCodesService) {}

  @Get()
  list() {
    return this.promo.list();
  }

  @Post()
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promo.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promo.update(id, dto);
  }
}

@Module({
  controllers: [PromoQuoteController, AdminPromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoModule {}
