import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Result, RichResult } from '../result/types.js';
import { isRich } from '../result/guards.js';

function isResult(value: unknown): value is Result<unknown, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof (value as Record<string, unknown>)['ok'] === 'boolean'
  );
}

/**
 * Transforms `Result<T, E>` and `RichResult<T, E>` return values into a
 * consistent JSON response shape, so controllers don't need to unwrap manually.
 *
 * Plain results:
 * ```json
 * { "ok": true,  "data": <value> }
 * { "ok": false, "error": "<string>" }
 * ```
 *
 * Rich results also include a `meta` block:
 * ```json
 * { "ok": true, "data": <value>, "meta": { "operation": "...", "durationMs": 12, ... } }
 * ```
 *
 * Non-Result return values are passed through unchanged.
 *
 * @example
 * // Global
 * app.useGlobalInterceptors(app.get(ResultInterceptor));
 *
 * // Per-controller
 * @UseInterceptors(ResultInterceptor)
 * @Controller('users')
 * export class UsersController { ... }
 */
@Injectable()
export class ResultInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map(value => {
        if (!isResult(value)) return value;

        const base = value.ok
          ? { ok: true,  data:  (value as { value: unknown }).value }
          : { ok: false, error: String((value as { error: unknown }).error) };

        if (!isRich(value)) return base;

        const rich = value as RichResult<unknown, unknown>;
        return {
          ...base,
          meta: {
            ...(rich.operation     ? { operation:     rich.operation }     : {}),
            ...(rich.correlationId ? { correlationId: rich.correlationId } : {}),
            ...(rich.tags?.length  ? { tags:          rich.tags }          : {}),
            durationMs: rich.durationMs,
            timestamp:  rich.timestamp,
          },
        };
      }),
    );
  }
}
