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

export const UseCircuitBreaker = (options: CircuitBreakerGuardOptions) =>
  Reflector.createDecorator<CircuitBreakerGuardOptions>({
    key: 'circuit-breaker',
    transform: () => options,
  });

@Injectable()
export class CircuitBreakerGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CircuitBreakerRegistry) private readonly registry: CircuitBreakerRegistry,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<CircuitBreakerGuardOptions>(
      'circuit-breaker',
      context.getHandler(),
    );
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
