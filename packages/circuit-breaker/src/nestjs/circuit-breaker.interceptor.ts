import {
  Injectable,
  Inject,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, firstValueFrom, race, timer } from 'rxjs';
import { CircuitBreakerRegistry, isHttpServerError } from '../circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerOpenError } from '../circuit-breaker/circuit-breaker.js';

const DEFAULT_TIMEOUT_MS = 30_000;

@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  constructor(@Inject(CircuitBreakerRegistry) private readonly registry: CircuitBreakerRegistry) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const handlerName = context.getHandler().name;
    const className   = context.getClass().name;

    const cb = this.registry.getOrCreate({
      name:      `handler:${className}.${handlerName}`,
      isFailure: isHttpServerError,
    });

    try {
      const result = await cb.execute(() =>
        firstValueFrom(
          race([
            next.handle(),
            timer(DEFAULT_TIMEOUT_MS),
          ]),
        ),
      );
      return new Observable(sub => { sub.next(result); sub.complete(); });
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        throw new ServiceUnavailableException(
          'Service temporarily unavailable -- circuit breaker is open',
        );
      }
      if (error instanceof Error && error.message === 'Timeout has occurred') {
        throw new RequestTimeoutException('Handler timed out');
      }
      throw error;
    }
  }
}
