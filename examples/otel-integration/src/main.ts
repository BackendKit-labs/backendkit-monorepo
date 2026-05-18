import './instrumentation'; // must be first
import { NestFactory }      from '@nestjs/core';
import { AppModule }         from './app.module';
import { LoggerService }     from '@backendkit-labs/observability';

async function bootstrap() {
  const app    = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(LoggerService);
  app.useLogger(logger);
  await app.listen(3000);
}

bootstrap();
