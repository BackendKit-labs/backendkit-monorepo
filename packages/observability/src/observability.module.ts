import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CorrelationIdService }            from './correlation/correlation.service.js';
import { LoggerService }                   from './logger/logger.service.js';
import { MetricsService }                  from './metrics/metrics.service.js';
import { CorrelationInterceptor }          from './interceptors/correlation.interceptor.js';
import { PerformanceInterceptor }          from './interceptors/performance.interceptor.js';
import { AllExceptionsFilter }             from './filters/all-exceptions.filter.js';
import { OBSERVABILITY_OPTIONS }           from './observability.constants.js';
import { ObservabilityOptions }            from './observability.types.js';

@Module({})
export class ObservabilityModule {
  static forRoot(options: ObservabilityOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide:  OBSERVABILITY_OPTIONS,
      useValue: options,
    };

    const providers: Provider[] = [
      optionsProvider,
      CorrelationIdService,
      LoggerService,
      MetricsService,
      CorrelationInterceptor,
      PerformanceInterceptor,
      AllExceptionsFilter,
    ];

    return {
      module:   ObservabilityModule,
      global:   true,
      providers,
      exports:  [
        CorrelationIdService,
        LoggerService,
        MetricsService,
        CorrelationInterceptor,
        PerformanceInterceptor,
        AllExceptionsFilter,
      ],
    };
  }
}
