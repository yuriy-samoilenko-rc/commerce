import { Module } from '@nestjs/common';
import {
  AdminReviewsController,
  MyReviewsController,
  ProductReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [
    ProductReviewsController,
    MyReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService],
})
export class ReviewsModule {}
