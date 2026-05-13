import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable }        from '@nestjs/common';
import { randomUUID }        from 'node:crypto';
import { getActiveSpan }     from '../internal/otel.js';

const storage = new AsyncLocalStorage<string>();

@Injectable()
export class CorrelationIdService {
  /**
   * Run `fn` inside a context that carries `correlationId`.
   * All code executed within `fn` (including async continuations) can call
   * `get()` and receive the same ID without passing it explicitly.
   */
  run<T>(correlationId: string, fn: () => T): T {
    return storage.run(correlationId, fn);
  }

  /** Current correlation ID, or a fresh UUID when called outside a context. */
  get(): string {
    return storage.getStore() ?? randomUUID();
  }

  /**
   * Current correlation ID, or `undefined` when called outside a context.
   * Prefer `get()` for logging; use this only when you need to distinguish
   * "no context" from "context with a random ID".
   */
  getOrUndefined(): string | undefined {
    return storage.getStore();
  }

  /**
   * Active OTel trace + span IDs when @opentelemetry/api is installed and a
   * span is active; `undefined` otherwise.
   */
  getTraceContext(): { traceId: string; spanId: string } | undefined {
    const span = getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext?.();
    if (!ctx?.traceId) return undefined;
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  }
}
