import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { Logger as NestJSLogger } from '@nestjs/common';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    httpsOptions: {
      key: process.env.SERVER_KEY.trim(),
      cert: [process.env.SERVER_CERT.trim()],
      ca: process.env.DB_CA_CERT.trim(),
      requestCert: true,
      rejectUnauthorized: true,
    },
  });
  app.useLogger(app.get(Logger));
  const logger = new NestJSLogger();
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Social Retry')
    .setDescription('Retry mechanism for social sector.')
    .setVersion('1.0')
    .addTag('social-retry')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`api-spec`, app, documentFactory, {
    jsonDocumentUrl: `api-spec/json`,
  });
  const bodyLimit = process.env.BODY_SIZE_LIMIT ?? '7mb';
  app.use(json({ limit: bodyLimit }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  if (typeof process.exitCode === 'number' && process.exitCode > 0) {
    logger.fatal(`App failed to properly start, exiting...`);
    await app.close();
    process.exit(process.exitCode);
  }
  logger.log(`API is running on port: ${port}`, { port });
}
bootstrap();
