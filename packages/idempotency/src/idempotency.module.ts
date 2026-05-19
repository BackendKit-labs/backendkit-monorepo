import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector }        from '@nestjs/core';

import { IDEMPOTENCY_OPTIONS, IDEMPOTENCY_STORE } from './idempotency.constants.js';
import { IdempotencyInterceptor }                  from './interceptors/idempotency.interceptor.js';
import { InMemoryIdempotencyStore }                from './store/in-memory.store.js';
import type {
  IdempotencyModuleAsyncOptions,
  IdempotencyModuleOptions,
  IdempotencyOptionsFactory,
} from './idempotency.types.js';

type InjectionTokens = (InjectionToken | OptionalFactoryDependency)[];

@Module({})
export class IdempotencyModule {
  static forRoot(options: IdempotencyModuleOptions = {}): DynamicModule {
    return {
      global:    true,
      module:    IdempotencyModule,
      providers: [
        { provide: IDEMPOTENCY_OPTIONS, useValue: options },
        { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
        { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
        InMemoryIdempotencyStore,
        Reflector,
      ],
      exports: [IDEMPOTENCY_STORE],
    };
  }

  static forRootAsync(asyncOptions: IdempotencyModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = asyncOptions.useFactory
      ? {
          provide:    IDEMPOTENCY_OPTIONS,
          useFactory: asyncOptions.useFactory as (...args: unknown[]) => IdempotencyModuleOptions,
          inject:     (asyncOptions.inject ?? []) as InjectionTokens,
        }
      : {
          provide:  IDEMPOTENCY_OPTIONS,
          useFactory(factory: IdempotencyOptionsFactory) {
            return factory.createIdempotencyOptions();
          },
          inject: [asyncOptions.useExisting ?? asyncOptions.useClass!],
        };

    return {
      global:  true,
      module:  IdempotencyModule,
      imports: asyncOptions.imports ?? [],
      providers: [
        optionsProvider,
        { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
        { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
        InMemoryIdempotencyStore,
      ],
      exports: [IDEMPOTENCY_STORE],
    };
  }
}
