// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/nestjs/saga.interceptor.ts
//
// NestJS interceptor that extracts/injects correlation ID from HTTP headers
// and propagates it to saga executions.
// ---------------------------------------------------------------------------

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class SagaCorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const correlationId =
      request.headers?.[CORRELATION_ID_HEADER] ??
      request.headers?.[CORRELATION_ID_HEADER.toLowerCase()] ??
      undefined;

    if (correlationId !== undefined) {
      (request as Record<string, unknown>).correlationId = correlationId;
    }

    return next.handle();
  }
}
