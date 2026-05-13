import { getTracer, runInOtelContext } from '../internal/otel.js';

export interface TrackPerformanceOptions {
  /** OTel span / log operation name. Defaults to `ClassName.methodName`. */
  operation?: string;

  /** Attributes added to the OTel span. */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Method decorator that wraps the decorated async method in an OTel span
 * (when @opentelemetry/api is available) and records its duration.
 * Works with regular methods and NestJS service methods.
 *
 * @example
 * \@TrackPerformance()
 * async processPayment(id: string) { ... }
 */
export function TrackPerformance(options: TrackPerformanceOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const operationName =
      options.operation ?? `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const tracer = getTracer('@backendkit-labs/observability');
      const span   = tracer.startSpan(operationName);

      if (options.attributes) {
        span.setAttributes(options.attributes);
      }

      try {
        const result = await runInOtelContext(span, () => original.apply(this, args));
        span.setStatus({ code: 1 }); // SpanStatusCode.OK
        return result;
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({ code: 2, message: String(err) }); // SpanStatusCode.ERROR
        throw err;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}
