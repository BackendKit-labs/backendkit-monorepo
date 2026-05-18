import { Catch, ArgumentsHost, HttpException, Injectable, Inject, Optional } from '@nestjs/common';
import {
  AllExceptionsFilter,
  LoggerService,
  CorrelationIdService,
} from '@backendkit-labs/observability';

@Catch()
@Injectable()
export class SimAwareExceptionsFilter extends AllExceptionsFilter {
  constructor(
    @Inject(LoggerService) logger: LoggerService,
    @Optional() @Inject(CorrelationIdService) correlationSvc: CorrelationIdService | undefined,
  ) {
    super(logger, correlationSvc);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<{ url: string }>();
    if (req.url.startsWith('/sim/')) {
      const res = host.switchToHttp().getResponse<{
        status(code: number): { json(body: unknown): void };
      }>();
      const status =
        exception instanceof HttpException ? exception.getStatus() : 500;
      const message =
        exception instanceof HttpException
          ? (() => {
              const body = exception.getResponse();
              const raw =
                typeof body === 'string'
                  ? body
                  : ((body as { message?: unknown }).message ?? exception.message);
              return Array.isArray(raw) ? raw.join('; ') : String(raw);
            })()
          : 'Internal server error';
      res.status(status).json({ ok: false, statusCode: status, message });
      return;
    }
    super.catch(exception, host);
  }
}
