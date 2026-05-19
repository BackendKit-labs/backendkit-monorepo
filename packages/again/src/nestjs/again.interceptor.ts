import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AgainService } from './again.service.js';
import { AGAIN_METADATA_KEY } from './again.decorator.js';
import type { AgainConfig } from '../again/types.js';

@Injectable()
export class AgainInterceptor implements NestInterceptor {
  constructor(
    private readonly againService: AgainService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const againConfig = this.reflector.get<Partial<AgainConfig> | undefined>(
      AGAIN_METADATA_KEY,
      context.getHandler(),
    );

    if (!againConfig) {
      return next.handle();
    }

    return from(
      this.againService.execute(() => next.handle().toPromise(), againConfig),
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
