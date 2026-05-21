// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/nestjs/saga.module.ts
//
// NestJS Dynamic Module for saga orchestration.
//
// Usage:
//   @Module({
//     imports: [
//       SagaModule.forRoot({
//         stores: {
//           sagaStore: new InMemoryStore(),
//           lockProvider: new InMemoryLock(),
//           eventBus: new SagaEventBusImpl(),
//         },
//       }),
//     ],
//   })
//   class AppModule {}
// ---------------------------------------------------------------------------

import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { SagaOrchestrator } from './saga.service';
import { SagaCorrelationIdInterceptor } from './saga.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { SagaStore } from '../persistence/saga-store.interface';
import type { LockProvider } from '../types/lock.types';
import type { SagaEventBus } from '../types/events.types';
import type { RetryPolicy } from '../types/step.types';

// ---- SagaModuleOptions ----

export const SAGA_OPTIONS_TOKEN = 'SAGA_MODULE_OPTIONS';

export interface SagaStoreSet {
  sagaStore: SagaStore;
  lockProvider: LockProvider;
  eventBus: SagaEventBus;
}

export interface SagaModuleOptions {
  stores: SagaStoreSet;
  defaults?: {
    retryPolicy?: RetryPolicy;
    timeoutMs?: number;
  };
  observation?: {
    enabled: boolean;
  };
}

// ---- SagaModule ----

@Global()
@Module({})
export class SagaModule {
  /**
   * Import once at the root of your application.
   * Provides SagaOrchestrator and SagaCorrelationIdInterceptor.
   */
  static forRoot(options: SagaModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: SAGA_OPTIONS_TOKEN,
      useValue: options,
    };

    const interceptorProvider: Provider = {
      provide: APP_INTERCEPTOR,
      useClass: SagaCorrelationIdInterceptor,
    };

    return {
      module: SagaModule,
      providers: [optionsProvider, SagaOrchestrator, interceptorProvider],
      exports: [SagaOrchestrator],
      global: true,
    };
  }

  /**
   * Import in feature modules that define sagas.
   * Ensures SagaOrchestrator is available for injection.
   */
  static forFeature(): DynamicModule {
    return {
      module: SagaModule,
      providers: [SagaOrchestrator],
      exports: [SagaOrchestrator],
    };
  }
}
