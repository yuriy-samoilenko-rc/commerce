import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './audit/request-context';
import { mediaRoot } from './media/media-storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(requestContextMiddleware);
  // Product photos, public (the shop shows them to everyone). File names contain a new
  // id for every upload, so they never change and browsers may cache them for good.
  app.useStaticAssets(mediaRoot(), {
    prefix: '/media/',
    index: false,
    dotfiles: 'deny',
    immutable: true,
    maxAge: '365d',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // API description (UI at /api/docs). Turn it off in production with API_DOCS=false.
  if (process.env.API_DOCS !== 'false') {
    const openapi = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('TechStore API')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, openapi, {
      jsonDocumentUrl: 'api/openapi.json',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
