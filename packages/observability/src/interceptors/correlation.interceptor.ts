import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable }           from 'rxjs';
import { randomUUID }           from 'node:crypto';
import { CorrelationIdService } from '../correlation/correlation.service.js';

const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Only allow characters safe for logs, HTTP headers and JSON.
 * Rejects newlines, control chars, and excessively long values.
 */
const CORRELATION_ID_REGEX = /^[a-zA-Z0-9\-_:]{1,64}$/;

function sanitizeCorrelationId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length > 64) return null;
  if (!CORRELATION_ID_REGEX.test(raw)) return null;
  return raw;
}

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
    const correlationId = sanitizeCorrelationId(incomingId) ?? randomUUID();

    res.setHeader(CORRELATION_HEADER, correlationId);

    return new Observable(subscriber => {
      this.correlationSvc.run(correlationId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
