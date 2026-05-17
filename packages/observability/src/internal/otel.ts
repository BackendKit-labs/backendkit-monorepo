/**
 * Optional OpenTelemetry shim.
 * If @opentelemetry/api is not installed all operations become no-ops,
 * so the package works without any tracing backend.
 */

import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let otel: any = null;

try {
  // Dynamic require keeps OTel out of the bundle when not installed
  otel = _require('@opentelemetry/api');
} catch {
  // OTel not installed — spans will be no-ops
}

export const isOtelAvailable = (): boolean => otel !== null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTracer = (name: string): any =>
  otel?.trace?.getTracer(name) ?? noopTracer;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getActiveSpan = (): any =>
  otel ? otel.trace.getSpan(otel.context.active()) : undefined;

export const runInOtelContext = async <T>(span: unknown, fn: () => Promise<T>): Promise<T> => {
  if (!otel || !span) return fn();
  return otel.context.with(otel.trace.setSpan(otel.context.active(), span), fn);
};

interface SpanShim {
  setAttribute(key: string, value: unknown): void;
  setAttributes(attrs: Record<string, unknown>): void;
  recordException(err: Error): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
  spanContext(): { traceId: string; spanId: string };
}

const noopSpan: SpanShim = {
  end:             () => {},
  setAttribute:    () => {},
  setAttributes:   () => {},
  recordException: () => {},
  setStatus:       () => {},
  spanContext:     () => ({ traceId: '', spanId: '' }),
};

const noopTracer = {
  startSpan:       () => noopSpan,
  startActiveSpan: (_name: string, fn: (span: unknown) => unknown) => fn(noopSpan),
};
