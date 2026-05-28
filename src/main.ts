// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  });

  app.setGlobalPrefix('appointments');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('clinic-appointment-service')
      .setDescription('Microservicio de citas médicas.')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-id' }, 'x-user-id')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-role' }, 'x-user-role')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  logger.log(`clinic-appointment-service escuchando en :${port}`);
}

void bootstrap();
