import { SetMetadata } from '@nestjs/common';
import { RetryRegistry } from '../retry/retry.registry.js';
import type { RetryConfig } from '../retry/types.js';

export const RETRY_METADATA_KEY = 'retry:config';

/**
 * Own default registry, used when the decorated class has no `retryRegistry`
 * property injected -- mirrors the standalone `retry()` function's registry
 * so `@Retry` works without requiring DI wiring.
 */
const defaultRegistry = new RetryRegistry();

/**
 * Wraps a method in retry logic directly -- works on any method (service or
 * controller), with or without NestJS DI. Also sets metadata for
 * introspection/RetryInterceptor, but the decorator itself is what actually
 * retries; enabling RetryModule's global interceptor on top of `@Retry`-
 * decorated methods double-retries them (see RetryModule's
 * `globalInterceptor` option, off by default for this reason).
 *
 * Optionally inject `public readonly retryRegistry: RetryRegistry` on the
 * class to get a named, shared RetryEngine per method (so budget/idempotency
 * config actually accumulates across calls, and metrics are inspectable via
 * the registry) instead of the internal default registry.
 *
 * @example
 * ```ts
 * @Retry({ maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 200 } })
 * async fetchData() { ... }
 * ```
 */
export function Retry(config: Partial<RetryConfig>): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const className = (target as { constructor?: { name?: string } }).constructor?.name ?? 'anonymous';
    const engineName = `method:${className}.${String(propertyKey)}`;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      const registry = (this as { retryRegistry?: RetryRegistry }).retryRegistry ?? defaultRegistry;
      const engine = registry.getOrCreate(engineName);

      return engine.execute(() => Promise.resolve(originalMethod.apply(this, args)), config)
        .then((result) => {
          if (result.ok) return result.value;
          throw result.error;
        });
    };

    SetMetadata(RETRY_METADATA_KEY, config)(target, propertyKey, descriptor);
    return descriptor;
  };
}
