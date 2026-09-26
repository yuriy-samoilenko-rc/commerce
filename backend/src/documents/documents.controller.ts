import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { Role } from '../generated/prisma/client';
import { PublicUser } from '../users/users.service';
import { DocumentQueryDto, DocumentsService } from './documents.service';

function sendPdf(
  res: Response,
  file: { buffer: Buffer; fileName: string },
  download?: string,
) {
  res.set({
    'Content-Type': 'application/pdf',
    // inline opens in the browser (print from there); ?download=true saves the file
    'Content-Disposition': `${download === 'true' ? 'attachment' : 'inline'}; filename="${file.fileName}"`,
  });
  return new StreamableFile(file.buffer);
}

@Controller('admin/documents')
@Roles(...STAFF_ROLES)
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query() query: DocumentQueryDto) {
    return this.documents.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.findOne(id);
  }

  @Get(':id/pdf')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendPdf(res, await this.documents.pdf(id), download);
  }
}

// A customer sees the invoices, delivery notes and warranty cards of their own orders.
@Controller('documents')
@Roles(Role.CUSTOMER)
export class MyDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query() query: DocumentQueryDto, @CurrentUser() user: PublicUser) {
    return this.documents.list(query, user.id);
  }

  @Get(':id/pdf')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('download') download: string | undefined,
    @CurrentUser() user: PublicUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendPdf(res, await this.documents.pdf(id, user.id), download);
  }
}
