import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { badRequest } from '../common/errors';
import { Role } from '../generated/prisma/client';
import {
  BannersService,
  CreateBannerDto,
  MAX_BANNER_BYTES,
  ReorderBannersDto,
} from './banners.service';

class UpdateBannerDto extends PartialType(CreateBannerDto, {
  skipNullProperties: false,
}) {}

@Public()
@Controller('shop/banners')
export class ShopBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  live() {
    return this.banners.live();
  }
}

/** The home page slider is marketing: the admin and the manager run it. */
@Controller('admin/banners')
@Roles(Role.ADMIN, Role.MANAGER)
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  list() {
    return this.banners.list();
  }

  @Post()
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Put('order')
  reorder(@Body() dto: ReorderBannersDto) {
    return this.banners.reorder(dto.ids);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.banners.remove(id);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BANNER_BYTES, files: 1 },
      // A first cheap filter; the real check decodes the file (BannersService).
      fileFilter: (_req, file, done) =>
        /^image\/(jpeg|png|webp)$/.test(file.mimetype)
          ? done(null, true)
          : done(
              badRequest(
                'IMAGE_FORMAT',
                `${file.originalname} is not a JPEG, PNG or WebP image`,
                { file: file.originalname },
              ),
              false,
            ),
    }),
  )
  setImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.banners.setImage(id, file);
  }

  @Delete(':id/image')
  removeImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.banners.removeImage(id);
  }
}

@Module({
  controllers: [ShopBannersController, AdminBannersController],
  providers: [BannersService],
})
export class BannersModule {}
