import type { Type } from '@nestjs/common';
import type { PipelineStep, PipelineOptions } from '../core/types.js';
import type { PipelineToken } from '../core/define-pipeline.js';

export interface PipelineDefinition<TContext = unknown, TError = unknown> {
  token:    PipelineToken<TContext, TError>;
  steps:    Type<PipelineStep<TContext, TError>>[];
  options?: PipelineOptions<TContext, TError>;
}

export interface PipelineModuleOptions {
  pipelines: PipelineDefinition[];
}
