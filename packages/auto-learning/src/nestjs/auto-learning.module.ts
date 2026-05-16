import { DynamicModule, Module, Provider, LoggerService } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AutoLearningCore, AutoLearningCoreOptions } from '../core/auto-learning-core.js';
import { AutoLearningInterceptor } from './auto-learning.interceptor.js';
import { AUTO_LEARNING_OPTIONS, AUTO_LEARNING_INSTANCE } from './auto-learning.constants.js';
import { BackendKitObservabilityAdapter } from './backend-kit-observability-adapter.js';
import { ObservabilityAdapter } from '../core/observability/observability-adapter.js';

export type AutoLearningModuleOptions = {
  intervalMs?: number;
  storage?: 'memory' | 'redis' | 'sql';
  redisUrl?: string;
  observability?: {
    logger?: LoggerService;
    metrics?: {
      increment?: (name: string, value?: number, tags?: Record<string, string>) => void;
      gauge?: (name: string, value: number, tags?: Record<string, string>) => void;
      histogram?: (name: string, value: number, tags?: Record<string, string>) => void;
    };
  };
  coreOptions?: Omit<AutoLearningCoreOptions, 'storage' | 'observability'>;
};

@Module({})
export class AutoLearningModule {
  static forRoot(options: AutoLearningModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: AUTO_LEARNING_OPTIONS,
        useValue: options,
      },
      {
        provide: AUTO_LEARNING_INSTANCE,
        useFactory: (opts: AutoLearningModuleOptions) => {
          let observability: ObservabilityAdapter | undefined;

          if (opts.observability?.logger) {
            observability = new BackendKitObservabilityAdapter(
              opts.observability.logger,
              opts.observability.metrics,
            );
          }

          return AutoLearningCore.create({
            ...opts.coreOptions,
            observability,
          });
        },
        inject: [AUTO_LEARNING_OPTIONS],
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: AutoLearningInterceptor,
      },
    ];

    return {
      module: AutoLearningModule,
      providers,
      exports: [AUTO_LEARNING_INSTANCE],
      global: true,
    };
  }
}
