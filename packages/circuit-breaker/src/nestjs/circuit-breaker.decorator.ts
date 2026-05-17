import { CircuitBreakerRegistry, isHttpServerError } from '../circuit-breaker/circuit-breaker.registry.js';

/**
 * Method decorator that wraps execution inside a named circuit breaker.
 * The class must have `circuitBreakerRegistry: CircuitBreakerRegistry` injected.
 *
 * Business errors (HTTP 4xx by default) pass through without affecting the circuit state.
 *
 * @throws Error at decoration time if the registry is not injected in the class.
 */
export function WithCircuitBreaker(options: {
  name: string;
  failureThreshold?: number;
  openTimeoutMs?: number;
  isFailure?: (error: unknown) => boolean;
  fallback?: (error: unknown) => unknown | Promise<unknown>;
}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const registry = (this as { circuitBreakerRegistry?: CircuitBreakerRegistry })
        .circuitBreakerRegistry;
      if (!registry) {
        throw new Error(
          `@WithCircuitBreaker('${options.name}'): CircuitBreakerRegistry not injected. ` +
          'Ensure the class has `private readonly circuitBreakerRegistry: CircuitBreakerRegistry` ' +
          'in its constructor.',
        );
      }

      const cb = registry.getOrCreate({
        name:             options.name,
        failureThreshold: options.failureThreshold ?? 50,
        openTimeoutMs:    options.openTimeoutMs    ?? 60_000,
        isFailure:        options.isFailure        ?? isHttpServerError,
      });

      return cb.execute(
        () => originalMethod.apply(this, args),
        options.fallback as ((error: unknown) => unknown | Promise<unknown>) | undefined,
      );
    };

    return descriptor;
  };
}
