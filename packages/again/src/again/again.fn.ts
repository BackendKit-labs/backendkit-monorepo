import { type Result } from '@backendkit-labs/result';
import type { AgainConfig, AgainError } from './types.js';
import { AgainRegistry } from './again.registry.js';

const defaultRegistry = new AgainRegistry();

/**
 * Standalone sugar function for simple retry cases.
 * Uses a global default AgainRegistry under the hood.
 *
 * @example
 * ```ts
 * const result = await again(() => fetchUser(id), { maxAttempts: 3 });
 * result.match(
 *   (user) => res.json(user),
 *   (error) => res.status(502).json({ error: error.message }),
 * );
 * ```
 */
export async function again<T>(
  task: () => Promise<T>,
  options?: Partial<AgainConfig>,
): Promise<Result<T, AgainError>> {
  const engine = defaultRegistry.getOrCreate('__default__');
  return engine.execute(task, options);
}
