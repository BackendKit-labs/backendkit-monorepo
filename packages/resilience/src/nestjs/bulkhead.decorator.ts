import { BulkheadRegistry } from '../bulkhead/bulkhead.registry.js';

/**
 * Method decorator that wraps execution inside a named bulkhead.
 * The class must have `bulkheadRegistry: BulkheadRegistry` injected.
 */
export function WithBulkhead(options: {
  name: string;
  maxConcurrent?: number;
  timeoutMs?: number;
}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const registry = (this as { bulkheadRegistry?: BulkheadRegistry }).bulkheadRegistry;
      if (!registry) throw new Error('BulkheadRegistry not injected in class.');

      const bulkhead = registry.getOrCreate({
        name: options.name,
        maxConcurrentCalls: options.maxConcurrent ?? 5,
        queueTimeoutMs: options.timeoutMs ?? 30_000,
        maxQueueSize: 50,
        rejectWhenFull: true,
      });

      return bulkhead.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
