import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CircuitBreakerRegistry } from '../circuit-breaker/circuit-breaker.registry.js';
import { isHttpServerError } from '../circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerState } from '../circuit-breaker/circuit-breaker.js';

export interface CircuitBreakerGuardOptions {
  /** Named circuit breaker to use */
  name: string;
  /** Failure threshold % to open the circuit. Default: 50 */
  failureThreshold?: number;
  /**
   * Custom error classifier. Defaults to `isHttpServerError`:
   * only HTTP 5xx and non-HTTP errors open the circuit.
   */
  isFailure?: (error: unknown) => boolean;
}

/**
 * Immutable DTO exposed on the request object.
 * Contains only read-only state -- never the full CircuitBreaker instance.
 */
export interface CircuitBreakerRequestInfo {
  readonly name: string;
  readonly state: CircuitBreakerState;
  readonly canAttempt: boolean;
}

/**
 * Created once at module scope, as `Reflector.createDecorator` requires --
 * it returns a decorator *factory*, not a decorator itself. Calling it again
 * per-request (as `UseCircuitBreaker` used to) produced a fresh, unused
 * factory instead of attaching metadata, so the guard never saw any options.
 */
const CIRCUIT_BREAKER_METADATA = Reflector.createDecorator<CircuitBreakerGuardOptions>();

export const UseCircuitBreaker = (options: CircuitBreakerGuardOptions) =>
  CIRCUIT_BREAKER_METADATA(options);

/**
 * Fails fast when the named circuit is already OPEN -- it runs before body
 * parsing/validation and other pipes, so a `Guard` is cheaper than letting
 * the request reach the handler.
 *
 * A `Guard` only ever reads state (`canAttempt()`); NestJS's `CanActivate`
 * contract has no hook for "after the handler ran", so this guard alone can
 * never *open* the circuit. Pair it with `@WithCircuitBreaker({ name })`
 * (same `name`) on the handler/service method, or use `CircuitBreakerInterceptor`
 * instead, so something in the chain actually records success/failure.
 */
@Injectable()
export class CircuitBreakerGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CircuitBreakerRegistry) private readonly registry: CircuitBreakerRegistry,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get(CIRCUIT_BREAKER_METADATA, context.getHandler());
    if (!options) return true;

    const cb = this.registry.getOrCreate({
      name:             options.name,
      failureThreshold: options.failureThreshold ?? 50,
      isFailure:        options.isFailure ?? isHttpServerError,
    });

    if (!cb.canAttempt()) {
      throw new ServiceUnavailableException(
        `Circuit breaker '${options.name}' is open -- service unavailable`,
      );
    }

    // Expose only an immutable DTO, never the full CircuitBreaker instance
    const request = context.switchToHttp().getRequest() as Record<string, unknown>;
    const info: CircuitBreakerRequestInfo = {
      name: cb.getMetrics().name,
      state: cb.getState(),
      canAttempt: true,
    };
    request['circuitBreaker'] = info;
    return true;
  }
}
