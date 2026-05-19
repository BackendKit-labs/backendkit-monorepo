import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENCY_META_KEY } from '../idempotency.constants.js';
import type { IdempotentOptions } from '../idempotency.types.js';

export const Idempotent = (options: IdempotentOptions = {}): MethodDecorator =>
  SetMetadata(IDEMPOTENCY_META_KEY, options);
