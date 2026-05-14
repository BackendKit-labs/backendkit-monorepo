import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Pipeline } from '../core/pipeline.js';
import type { PipelineStep } from '../core/types.js';
import type { PipelineModuleOptions } from './pipeline.options.js';

@Module({})
export class PipelineModule {
  static forRoot(options: PipelineModuleOptions): DynamicModule {
    const providers: Provider[] = [];

    for (const def of options.pipelines) {
      for (const step of def.steps) {
        providers.push({ provide: step, useClass: step });
      }

      providers.push({
        provide:    def.token.symbol,
        useFactory: (...stepInstances: PipelineStep<unknown, unknown>[]) => {
          const p = new Pipeline(def.options ?? {});
          for (const instance of stepInstances) {
            p.pipe(instance);
          }
          return p;
        },
        inject: def.steps,
      });
    }

    return {
      module:    PipelineModule,
      providers,
      exports:   providers,
      global:    true,
    };
  }
}
