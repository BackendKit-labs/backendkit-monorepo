import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { LoggerService }        from '../logger/logger.service.js';
import { CorrelationIdService } from '../correlation/correlation.service.js';
import { getActiveSpan }        from '../internal/otel.js';

export type ErrorMapper = (error: unknown) => {
  statusCode: number;
  message:    string;
  code?:      string;
} | null;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly mappers: ErrorMapper[] = [];

  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
    @Optional()
    @Inject(CorrelationIdService)
    private readonly correlationSvc: CorrelationIdService | undefined,
  ) {}

  /**
   * Register a custom error mapper.
   * Mappers are tried in order; the first non-null result wins.
   * Return `null` to fall through to the next mapper.
   */
  addMapper(mapper: ErrorMapper): this {
    this.mappers.push(mapper);
    return this;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx  = host.switchToHttp();
    const res  = ctx.getResponse<{
      status(code: number): { json(body: unknown): void };
    }>();

    const mapped = this.resolveError(exception);

    const correlationId = this.correlationSvc?.getOrUndefined();
    const span          = getActiveSpan();
    span?.recordException(exception instanceof Error ? exception : new Error(String(exception)));

    this.logger.error(
      mapped.message,
      exception instanceof Error ? exception.stack : undefined,
      AllExceptionsFilter.name,
    );

    res.status(mapped.statusCode).json({
      ok:            false,
      statusCode:    mapped.statusCode,
      message:       mapped.message,
      code:          mapped.code,
      correlationId,
      timestamp:     new Date().toISOString(),
    });
  }

  private resolveError(exception: unknown): {
    statusCode: number;
    message:    string;
    code?:      string;
  } {
    for (const mapper of this.mappers) {
      const result = mapper(exception);
      if (result !== null) return result;
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : (body as { message?: string }).message ?? exception.message;
      return { statusCode: exception.getStatus(), message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:    'Internal server error',
    };
  }
}
