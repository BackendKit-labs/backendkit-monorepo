import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { RetryService } from './retry.service.js';
import { RETRY_METADATA_KEY } from './retry.decorator.js';
import type { RetryConfig } from '../retry/types.js';

@Injectable()
export class RetryInterceptor implements NestInterceptor {
  constructor(
    private readonly RetryService: RetryService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const RetryConfig = this.reflector.get<Partial<RetryConfig> | undefined>(
      RETRY_METADATA_KEY,
      context.getHandler(),
    );

    if (!RetryConfig) {
      return next.handle();
    }

    return from(
      this.RetryService.execute(() => next.handle().toPromise(), RetryConfig),
    ).pipe(
      switchMap((result) => {
        if (result.ok) {
          const value = result.value;
          if (value instanceof Observable) return value;
          return from(Promise.resolve(value));
        }
        throw result.error;
      }),
    );
  }
}
