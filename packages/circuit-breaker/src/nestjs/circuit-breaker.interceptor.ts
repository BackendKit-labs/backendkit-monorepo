import {
  Injectable,
  Inject,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, firstValueFrom } from 'rxjs';
import { CircuitBreakerRegistry, isHttpServerError } from '../circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerOpenError } from '../circuit-breaker/circuit-breaker.js';

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
      const result = await cb.execute(() => firstValueFrom(next.handle()));
      return new Observable(sub => { sub.next(result); sub.complete(); });
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        throw new ServiceUnavailableException(
          'Service temporarily unavailable — circuit breaker is open',
        );
      }
      throw error;
    }
  }
}
