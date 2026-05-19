import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import {
  PerformanceInterceptor,
  LoggerService,
  CorrelationIdService,
} from '@backendkit-labs/observability';
import { SimAwareExceptionsFilter } from './filters/sim-aware-exceptions.filter';

const CORRELATION_HEADER = 'x-correlation-id';
const SAFE_ID = /^[a-zA-Z0-9\-_:]{1,64}$/;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const logger        = app.get(LoggerService);
  const correlationSvc = app.get(CorrelationIdService);
  app.useLogger(logger);

  // Establish the AsyncLocalStorage context at the Express middleware level so
  // that every async continuation within the request (interceptors, services,
  // filters) inherits the same correlationId without relying on RxJS scheduling.
  app.use((req: any, res: any, next: () => void) => {
    const incoming = req.headers[CORRELATION_HEADER];
    const id = typeof incoming === 'string' && SAFE_ID.test(incoming)
      ? incoming
      : randomUUID();
    res.setHeader(CORRELATION_HEADER, id);
    correlationSvc.run(id, () => next());
  });

  app.useGlobalFilters(app.get(SimAwareExceptionsFilter));
  app.useGlobalInterceptors(app.get(PerformanceInterceptor));

  const port = parseInt(process.env.PORT ?? '3003', 10);
  await app.listen(port);
  logger.log(`Shopify Backend running on port ${port}`, 'Bootstrap');
}
bootstrap();
