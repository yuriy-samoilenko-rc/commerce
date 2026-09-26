import { Global, Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailWorker } from './mail-worker.service';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [MailController],
  providers: [MailService, MailWorker],
  exports: [MailService],
})
export class MailModule {}
