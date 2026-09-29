import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { badRequest } from '../common/errors';
import { Role } from '../generated/prisma/client';
import { ReorderImagesDto, UpdateImageDto } from './dto/product-image.dto';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  ProductImagesService,
} from './product-images.service';

/** Product photos for the shop. Editing the catalog is the administrator's job. */
@Controller('admin/products/:id/images')
@Roles(...STAFF_ROLES)
export class ProductImagesController {
  constructor(private readonly images: ProductImagesService) {}

  @Get()
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.images.list(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES },
      // A first cheap filter; the real check decodes the file (ProductImagesService).
      fileFilter: (_req, file, done) =>
        /^image\/(jpeg|png|webp)$/.test(file.mimetype)
          ? done(null, true)
          : done(
              badRequest(
                'IMAGE_FORMAT',
                `${file.originalname} is not a JPEG, PNG or WebP image`,
                {
                  file: file.originalname,
                },
              ),
              false,
            ),
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.images.upload(id, files);
  }

  @Roles(Role.ADMIN)
  @Put('order')
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.images.reorder(id, dto.ids);
  }

  @Roles(Role.ADMIN)
  @Patch(':imageId')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.images.update(id, imageId, dto.alt ?? null);
  }

  @Roles(Role.ADMIN)
  @Delete(':imageId')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.remove(id, imageId);
  }
}
