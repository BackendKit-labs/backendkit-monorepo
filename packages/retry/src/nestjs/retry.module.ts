import { Module, DynamicModule, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RetryEngine } from '../retry/retry.engine.js';
import { RetryRegistry } from '../retry/retry.registry.js';
import { RetryService } from './retry.service.js';
import { RetryInterceptor } from './retry.interceptor.js';
import { RETRY_ENGINE_TOKEN, RETRY_REGISTRY_TOKEN } from './retry.constants.js';
import type { RetryEngineConfig } from '../retry/types.js';

export interface RetryModuleOptions {
  engineConfig?: Partial<RetryEngineConfig>;
  globalInterceptor?: boolean;
}

@Module({})
export class RetryModule {
  static forRoot(options?: RetryModuleOptions): DynamicModule {
    const engineConfig = options?.engineConfig ?? { name: 'default' };

    const providers: Provider[] = [
      {
        provide: RETRY_REGISTRY_TOKEN,
        useFactory: () => new RetryRegistry(),
      },
      {
        provide: RETRY_ENGINE_TOKEN,
        useFactory: (registry: RetryRegistry) =>
          registry.getOrCreate(engineConfig.name ?? 'default', engineConfig),
        inject: [RETRY_REGISTRY_TOKEN],
      },
      {
        provide: RetryService,
        useFactory: (engine: RetryEngine) => new RetryService(engine),
        inject: [RETRY_ENGINE_TOKEN],
      },
    ];

    if (options?.globalInterceptor !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: RetryInterceptor,
      });
    }

    return {
      module: RetryModule,
      providers,
      exports: [RetryService, RETRY_ENGINE_TOKEN, RETRY_REGISTRY_TOKEN],
    };
  }
}
