import { SetMetadata } from '@nestjs/common';
import type { RetryConfig } from '../retry/types.js';

export const RETRY_METADATA_KEY = 'retry:config';

/**
 * Decorator that marks a method for retry.
 *
 * @example
 * ```ts
 * @Retry({ maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 200 } })
 * async fetchData() { ... }
 * ```
 */
export function Retry(config: Partial<RetryConfig>): MethodDecorator {
  return SetMetadata(RETRY_METADATA_KEY, config);
}
