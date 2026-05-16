import { SetMetadata } from '@nestjs/common';
import { AUTO_LEARN_METADATA } from './auto-learning.constants.js';

export type AutoLearnOptions = {
  trackParams?: boolean;
  trackBody?: boolean;
  customMetadata?: (req: any) => Record<string, unknown>;
};

export const AutoLearn = (options?: AutoLearnOptions): MethodDecorator =>
  SetMetadata(AUTO_LEARN_METADATA, options ?? {});
