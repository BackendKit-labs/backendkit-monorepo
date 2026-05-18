import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import {
  CorrelationInterceptor,
  PerformanceInterceptor,
  LoggerService,
} from '@backendkit-labs/observability';
import { SimAwareExceptionsFilter } from './filters/sim-aware-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  app.useGlobalFilters(app.get(SimAwareExceptionsFilter));
  app.useGlobalInterceptors(app.get(CorrelationInterceptor), app.get(PerformanceInterceptor));

  const port = parseInt(process.env.PORT ?? '3003', 10);
  await app.listen(port);
  logger.log(`Shopify Backend running on port ${port}`, 'Bootstrap');
}
bootstrap();
