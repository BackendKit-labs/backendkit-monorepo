import { SetMetadata } from '@nestjs/common';
import type { AgainConfig } from '../again/types.js';

export const AGAIN_METADATA_KEY = 'again:config';

/**
 * Decorator that marks a method for retry.
 *
 * @example
 * ```ts
 * @Again({ maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 200 } })
 * async fetchData() { ... }
 * ```
 */
export function Again(config: Partial<AgainConfig>): MethodDecorator {
  return SetMetadata(AGAIN_METADATA_KEY, config);
}
