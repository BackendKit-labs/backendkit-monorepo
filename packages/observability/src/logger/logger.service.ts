import { Injectable, Inject, Optional, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston                                                          from 'winston';
import { CorrelationIdService }                                             from '../correlation/correlation.service.js';
import { OBSERVABILITY_OPTIONS }                                            from '../observability.constants.js';
import { ObservabilityOptions }                                             from '../observability.types.js';
import { WinstonHttpTransport }                                             from './winston-http.transport.js';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly winston: winston.Logger;

  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly opts: ObservabilityOptions,
    @Optional()
    @Inject(CorrelationIdService)
    private readonly correlationSvc?: CorrelationIdService,
  ) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const m = meta as Record<string, unknown>;
            const ctxPart  = m['context'] ? ` [${String(m['context'])}]` : '';
            const corrPart = typeof m['correlationId'] === 'string' && m['correlationId'] !== 'no-context'
              ? ` [${m['correlationId']}]`
              : '';
            const base = `${timestamp} [${level}]${ctxPart}${corrPart} ${message}`;
            return typeof m['trace'] === 'string' ? `${base}\n${m['trace']}` : base;
          }),
        ),
      }),
    ];

    if (opts.http) {
      transports.push(
        new WinstonHttpTransport({
          ...opts.http,
          format: winston.format.json(),
        }),
      );
    }

    this.winston = winston.createLogger({
      level:      opts.logLevel ?? 'info',
      transports,
      format:     winston.format.json(),
    });
  }

  log(message: string, context?: string): void {
    this.winston.info(message, this.buildMeta(context));
  }

  error(message: string, trace?: string, context?: string): void {
    this.winston.error(message, { ...this.buildMeta(context), trace });
  }

  warn(message: string, context?: string): void {
    this.winston.warn(message, this.buildMeta(context));
  }

  debug(message: string, context?: string): void {
    this.winston.debug(message, this.buildMeta(context));
  }

  verbose(message: string, context?: string): void {
    this.winston.verbose(message, this.buildMeta(context));
  }

  /** Log with additional arbitrary metadata. */
  logWithMeta(level: string, message: string, meta: Record<string, unknown>): void {
    const validLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
    const safeLevel = validLevels.includes(level) ? level : 'info';
    this.winston.log(safeLevel, message, { ...this.buildMeta(), ...meta });
  }

  private buildMeta(context?: string): Record<string, unknown> {
    const base: Record<string, unknown> = {
      service:       this.opts.serviceName,
      environment:   this.opts.environment ?? 'production',
      correlationId: this.correlationSvc?.get(),
    };
    if (context) base.context = context;
    return base;
  }
}
