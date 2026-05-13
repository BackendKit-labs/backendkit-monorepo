import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable }           from 'rxjs';
import { tap }                  from 'rxjs/operators';
import { randomUUID }           from 'node:crypto';
import { CorrelationIdService } from '../correlation/correlation.service.js';

const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(
    @Inject(CorrelationIdService)
    private readonly correlationSvc: CorrelationIdService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    const res = ctx.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();

    const incomingId =
      (req.headers as Record<string, string | undefined>)?.[CORRELATION_HEADER];
    const correlationId = (typeof incomingId === 'string' && incomingId)
      ? incomingId
      : randomUUID();

    res.setHeader(CORRELATION_HEADER, correlationId);

    return new Observable(subscriber => {
      this.correlationSvc.run(correlationId, () => {
        next.handle().pipe(
          tap({ error: () => {} }),
        ).subscribe(subscriber);
      });
    });
  }
}
