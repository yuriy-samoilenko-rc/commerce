import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { WishlistService } from './wishlist.service';

export class MergeWishlistDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  productIds: string[];
}

/** A customer's wishlist; a guest keeps theirs in the browser and merges it on login. */
@Controller('wishlist')
@Roles(Role.CUSTOMER)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.wishlist.list(user.id);
  }

  /** Just the ids, for hearts and counters on every page. */
  @Get('ids')
  ids(@CurrentUser() user: PublicUser) {
    return this.wishlist.ids(user.id);
  }

  @Put(':productId')
  add(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.wishlist.remove(user.id, productId);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(@Body() dto: MergeWishlistDto, @CurrentUser() user: PublicUser) {
    return this.wishlist.merge(user.id, dto.productIds);
  }
}
