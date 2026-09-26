import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PublicUser } from '../users/users.service';
import { NotificationsService } from './notifications.service';

class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

// Every logged-in user has their own bell (ТЗ UI п.35).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query() query: NotificationQueryDto, @CurrentUser() user: PublicUser) {
    return this.notifications.listMine(user.id, query);
  }

  /** Cheap enough to poll every few seconds for the badge. */
  @Get('unread-count')
  unreadCount(@CurrentUser() user: PublicUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: PublicUser) {
    return this.notifications.markAllRead(user.id);
  }
}
