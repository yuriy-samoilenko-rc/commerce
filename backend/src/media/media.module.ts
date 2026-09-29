import { Global, Module } from '@nestjs/common';
import { MediaStorage } from './media-storage.service';

@Global()
@Module({
  providers: [MediaStorage],
  exports: [MediaStorage],
})
export class MediaModule {}
