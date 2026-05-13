/**
 * Optional OpenTelemetry shim.
 * If @opentelemetry/api is not installed all operations become no-ops,
 * so the package works without any tracing backend.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let otel: any = null;

try {
  // Dynamic require keeps OTel out of the bundle when not installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  otel = require('@opentelemetry/api');
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runInOtelContext = async <T>(span: any, fn: () => Promise<T>): Promise<T> => {
  if (!otel || !span) return fn();
  return otel.context.with(otel.trace.setSpan(otel.context.active(), span), fn);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopSpan: any = {
  end:             () => {},
  setAttribute:    () => {},
  setAttributes:   () => {},
  recordException: () => {},
  setStatus:       () => {},
  spanContext:     () => ({ traceId: '', spanId: '' }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopTracer: any = {
  startSpan:       () => noopSpan,
  startActiveSpan: (_name: string, fn: (span: unknown) => unknown) => fn(noopSpan),
};
