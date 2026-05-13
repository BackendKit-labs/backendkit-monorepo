import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable }           from 'rxjs';
import { tap }                  from 'rxjs/operators';
import { LoggerService }        from '../logger/logger.service.js';
import { MetricsService }       from '../metrics/metrics.service.js';
import { CorrelationIdService } from '../correlation/correlation.service.js';
import { getActiveSpan }        from '../internal/otel.js';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    @Optional()
    @Inject(MetricsService)
    private readonly metrics: MetricsService | undefined,
    @Optional()
    @Inject(CorrelationIdService)
    private readonly correlationSvc: CorrelationIdService | undefined,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start  = Date.now();
    const req    = ctx.switchToHttp().getRequest<{
      method: string;
      url: string;
    }>();
    const method = req.method ?? 'UNKNOWN';
    const path   = req.url   ?? 'UNKNOWN';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - start;
          this.record(method, path, 'success', durationMs);
        },
        error: () => {
          const durationMs = Date.now() - start;
          this.record(method, path, 'error', durationMs);
        },
      }),
    );
  }

  private record(
    method: string,
    path: string,
    outcome: 'success' | 'error',
    durationMs: number,
  ): void {
    const correlationId = this.correlationSvc?.getOrUndefined();
    const span          = getActiveSpan();

    span?.setAttribute('http.method', method);
    span?.setAttribute('http.target', path);
    span?.setAttribute('http.duration_ms', durationMs);

    this.logger.logWithMeta('info', `${method} ${path} [${outcome}] ${durationMs}ms`, {
      method,
      path,
      outcome,
      durationMs,
      correlationId,
    });

    this.metrics?.record('http.request.duration', durationMs, {
      unit: 'ms',
      tags: { method, path, outcome },
    });
  }
}
