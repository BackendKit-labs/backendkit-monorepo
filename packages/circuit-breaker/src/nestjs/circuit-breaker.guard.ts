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
        `Circuit breaker '${options.name}' is open — service unavailable`,
      );
    }

    (context.switchToHttp().getRequest() as Record<string, unknown>)['circuitBreaker'] = cb;
    return true;
  }
}
