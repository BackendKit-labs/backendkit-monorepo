import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { Bulkhead, BulkheadRejectedError, BulkheadTimeoutError } from '../bulkhead/bulkhead.js';
import type { BulkheadMetrics } from '../bulkhead/bulkhead.js';

const DEFAULT_CONCURRENCY = 50;
const DEFAULT_MAX_QUEUE = 100;

/**
 * Global HTTP middleware that limits simultaneous in-flight requests.
 *
 * Configure via environment variables:
 *   HTTP_BULKHEAD_CONCURRENCY  — max concurrent requests  (default: 50)
 *   HTTP_BULKHEAD_MAX_QUEUE    — max queued requests       (default: 100)
 */
@Injectable()
export class HttpBulkheadMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpBulkheadMiddleware.name);
  private readonly bulkhead: Bulkhead;

  constructor() {
    const rawConcurrency = parseInt(process.env['HTTP_BULKHEAD_CONCURRENCY'] ?? '', 10);
    const concurrency =
      Number.isNaN(rawConcurrency) || rawConcurrency < 1 ? DEFAULT_CONCURRENCY : rawConcurrency;

    const rawMaxQueue = parseInt(process.env['HTTP_BULKHEAD_MAX_QUEUE'] ?? '', 10);
    const maxQueueSize =
      Number.isNaN(rawMaxQueue) || rawMaxQueue < 0 ? DEFAULT_MAX_QUEUE : rawMaxQueue;

    this.bulkhead = new Bulkhead({
      name: 'http:global',
      maxConcurrentCalls: concurrency,
      maxQueueSize,
      queueTimeoutMs: 30_000,
      rejectWhenFull: true,
    });

    this.logger.log(
      `HTTP Bulkhead ready — concurrency: ${concurrency}, maxQueue: ${maxQueueSize}`,
    );
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.bulkhead
      .execute(
        () =>
          new Promise<void>(resolve => {
            res.once('finish', resolve);
            res.once('close', resolve);
            next();
          }),
      )
      .catch((error: unknown) => {
        if (res.headersSent) return;
        if (error instanceof BulkheadRejectedError) {
          const m = this.bulkhead.getMetrics();
          this.logger.warn(
            `HTTP Bulkhead saturated [active=${m.activeCalls} queued=${m.queuedCalls}]` +
              ` — rejecting ${req.method} ${req.path}`,
          );
          res.status(429).json({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Service temporarily overloaded. Please retry in a few seconds.',
          });
        } else if (error instanceof BulkheadTimeoutError) {
          res.status(503).json({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'Request timed out waiting for processing.',
          });
        }
      });
  }

  getStats(): BulkheadMetrics {
    return this.bulkhead.getMetrics();
  }
}
