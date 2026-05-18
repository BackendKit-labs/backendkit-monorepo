import { Module }              from '@nestjs/common';
import { APP_INTERCEPTOR }      from '@nestjs/core';
import {
  ObservabilityModule,
  CorrelationInterceptor,
  PerformanceInterceptor,
} from '@backendkit-labs/observability';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule }       from '@backendkit-labs/bulkhead/nestjs';
import { AutoLearningModule }   from '@backendkit-labs/auto-learning/nestjs';
import { DemoModule }            from './demo/demo.module';

@Module({
  imports: [
    ObservabilityModule.forRoot({
      serviceName:  process.env.OTEL_SERVICE_NAME  ?? 'otel-demo',
      environment:  process.env.NODE_ENV            ?? 'development',
      logLevel:     'info',
    }),
    CircuitBreakerModule,
    BulkheadModule,
    AutoLearningModule.forRoot(),
    DemoModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: PerformanceInterceptor },
  ],
})
export class AppModule {}
