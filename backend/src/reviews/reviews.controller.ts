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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReviewStatus, Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import {
  CreateReviewDto,
  ReviewQueryDto,
  ReviewsService,
} from './reviews.service';

// Roles are per method: reading reviews is public, writing needs a customer.
@Controller('products/:id/reviews')
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reviews.listForProduct(id, query);
  }

  @Roles(Role.CUSTOMER)
  @Get('eligibility')
  eligibility(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.reviews.eligibility(id, user.id);
  }

  @Roles(Role.CUSTOMER)
  @Post()
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.reviews.create(id, user.id, dto);
  }
}

@Controller('reviews')
@Roles(Role.CUSTOMER)
export class MyReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  mine(@CurrentUser() user: PublicUser) {
    return this.reviews.listMine(user.id);
  }
}

/** Reviews are published only after an administrator or manager has read them. */
@Controller('admin/reviews')
@Roles(Role.ADMIN, Role.MANAGER)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: ReviewQueryDto) {
    return this.reviews.listForStaff(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.reviews.moderate(id, ReviewStatus.APPROVED, user.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.reviews.moderate(id, ReviewStatus.REJECTED, user.id);
  }
}
