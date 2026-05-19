import { Module, DynamicModule, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AgainEngine } from '../again/again.engine.js';
import { AgainRegistry } from '../again/again.registry.js';
import { AgainService } from './again.service.js';
import { AgainInterceptor } from './again.interceptor.js';
import { AGAIN_ENGINE_TOKEN, AGAIN_REGISTRY_TOKEN } from './again.constants.js';
import type { AgainEngineConfig } from '../again/types.js';

export interface AgainModuleOptions {
  engineConfig?: Partial<AgainEngineConfig>;
  globalInterceptor?: boolean;
}

@Module({})
export class AgainModule {
  static forRoot(options?: AgainModuleOptions): DynamicModule {
    const engineConfig = options?.engineConfig ?? { name: 'default' };

    const providers: Provider[] = [
      {
        provide: AGAIN_REGISTRY_TOKEN,
        useFactory: () => new AgainRegistry(),
      },
      {
        provide: AGAIN_ENGINE_TOKEN,
        useFactory: (registry: AgainRegistry) =>
          registry.getOrCreate(engineConfig.name ?? 'default', engineConfig),
        inject: [AGAIN_REGISTRY_TOKEN],
      },
      {
        provide: AgainService,
        useFactory: (engine: AgainEngine) => new AgainService(engine),
        inject: [AGAIN_ENGINE_TOKEN],
      },
    ];

    if (options?.globalInterceptor !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: AgainInterceptor,
      });
    }

    return {
      module: AgainModule,
      providers,
      exports: [AgainService, AGAIN_ENGINE_TOKEN, AGAIN_REGISTRY_TOKEN],
    };
  }
}
