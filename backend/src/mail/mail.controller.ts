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
import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EmailStatus, Role } from '../generated/prisma/client';
import { MailService } from './mail.service';

class EmailQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(EmailStatus) status?: EmailStatus;
  @IsOptional() @IsUUID() orderId?: string;
}

class SendDocumentDto {
  @IsOptional() @IsEmail() to?: string;
}

@Controller('admin')
export class MailController {
  constructor(private readonly mail: MailService) {}

  // ТЗ п.11: documents can be sent to the client.
  @Roles(Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT)
  @Post('documents/:id/send')
  @HttpCode(HttpStatus.ACCEPTED)
  sendDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDocumentDto,
  ) {
    return this.mail.sendDocument(id, dto.to);
  }

  @Roles(Role.ADMIN)
  @Get('emails')
  list(@Query() query: EmailQueryDto) {
    return this.mail.list(query);
  }

  @Roles(Role.ADMIN)
  @Post('emails/:id/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.mail.retry(id);
  }
}
