import { type Result } from '@backendkit-labs/result';
import type { RetryConfig, RetryError } from './types.js';
import { RetryRegistry } from './retry.registry.js';

const defaultRegistry = new RetryRegistry();

/**
 * Standalone sugar function for simple retry cases.
 * Uses a global default RetryRegistry under the hood.
 *
 * @example
 * ```ts
 * const result = await retry(() => fetchUser(id), { maxAttempts: 3 });
 * result.match(
 *   (user) => res.json(user),
 *   (error) => res.status(502).json({ error: error.message }),
 * );
 * ```
 */
export async function retry<T>(
  task: () => Promise<T>,
  options?: Partial<RetryConfig>,
): Promise<Result<T, RetryError>> {
  const engine = defaultRegistry.getOrCreate('__default__');
  return engine.execute(task, options);
}
