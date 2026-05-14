import { Inject } from '@nestjs/common';
import type { PipelineToken } from '../core/define-pipeline.js';

export const InjectPipeline = <TContext, TError>(
  token: PipelineToken<TContext, TError>,
): ReturnType<typeof Inject> => Inject(token.symbol);
