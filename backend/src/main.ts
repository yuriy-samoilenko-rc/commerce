import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './audit/request-context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(requestContextMiddleware);
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
