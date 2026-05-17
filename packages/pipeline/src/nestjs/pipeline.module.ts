import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { Pipeline } from '../core/pipeline.js';
import type { PipelineStep } from '../core/types.js';
import type { PipelineDefinition, PipelineModuleOptions } from './pipeline.options.js';

function validatePipelineDefinition(
  def: PipelineDefinition,
  index: number,
): void {
  if (!def.token) {
    throw new Error(
      `Pipeline definition at index ${index} is missing "token". Use definePipeline() to create one.`,
    );
  }

  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    throw new Error(
      `Pipeline "${def.token.description ?? index}" has no steps. Provide at least one step class.`,
    );
  }

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];
    if (typeof step !== 'function') {
      throw new Error(
        `Step at index ${i} in pipeline "${def.token.description ?? index}" is not a class/constructor. ` +
        `Expected a Type<PipelineStep>, got ${typeof step}.`,
      );
    }
  }
}

function isPipelineStep(instance: unknown): instance is PipelineStep<unknown, unknown> {
  return (
    typeof instance === 'object' &&
    instance !== null &&
    typeof (instance as PipelineStep<unknown, unknown>).handle === 'function'
  );
}

@Module({})
export class PipelineModule {
  static forRoot(options: PipelineModuleOptions): DynamicModule {
    const providers: Provider[] = [];

    for (let i = 0; i < options.pipelines.length; i++) {
      const def = options.pipelines[i];
      validatePipelineDefinition(def, i);

      for (const step of def.steps) {
        providers.push({ provide: step as Type, useClass: step as Type });
      }

      providers.push({
        provide:    def.token.symbol,
        useFactory: (...stepInstances: unknown[]) => {
          const p = new Pipeline(def.options ?? {});

          for (let j = 0; j < stepInstances.length; j++) {
            const instance = stepInstances[j];

            if (!isPipelineStep(instance)) {
              const stepName = (def.steps[j] as Type)?.name ?? String(j);
              throw new Error(
                `Step "${stepName}" in pipeline "${def.token.description}" does not implement PipelineStep. ` +
                `Expected a class with a "handle(ctx)" method.`,
              );
            }

            p.pipe(instance);
          }

          return p;
        },
        inject: def.steps as Type[],
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
