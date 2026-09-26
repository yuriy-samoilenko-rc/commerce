import { Global, Module } from '@nestjs/common';
import {
  AdminDocumentsController,
  MyDocumentsController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

// Global: receivings, transfers, orders, returns and inventory all issue documents.
@Global()
@Module({
  controllers: [AdminDocumentsController, MyDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
