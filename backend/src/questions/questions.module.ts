import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import {
  AnswerQuestionDto,
  AskQuestionDto,
  QuestionQueryDto,
  QuestionsService,
} from './questions.service';

// Reading is public, asking needs a customer account (keeps spam out).
@Controller('products/:id/questions')
export class ProductQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Public()
  @Get()
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.questions.listForProduct(id, query);
  }

  @Roles(Role.CUSTOMER)
  @Post()
  ask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AskQuestionDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.questions.ask(id, user.id, dto);
  }
}

@Controller('questions')
@Roles(Role.CUSTOMER)
export class MyQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  mine(@CurrentUser() user: PublicUser) {
    return this.questions.listMine(user.id);
  }
}

@Controller('admin/questions')
@Roles(Role.ADMIN, Role.MANAGER)
export class AdminQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(@Query() query: QuestionQueryDto) {
    return this.questions.listForStaff(query);
  }

  @Post(':id/answer')
  @HttpCode(HttpStatus.OK)
  answer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.questions.answer(id, user.id, dto);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  hide(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.questions.hide(id, user.id);
  }
}

@Module({
  controllers: [
    ProductQuestionsController,
    MyQuestionsController,
    AdminQuestionsController,
  ],
  providers: [QuestionsService],
})
export class QuestionsModule {}
