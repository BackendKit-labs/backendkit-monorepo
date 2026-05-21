import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limiter.decorator';
import { IRateLimiter } from '../interfaces/rate-limiter.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IMetricsRecorder } from '../interfaces/metrics.interface';
import { RateLimiterFactory } from '../factory';
import { RateLimiterConfig, AlgorithmType } from '../interfaces/config.interface';
import { RateLimitError } from '../errors/rate-limit-error';

export const RATE_LIMITER_INSTANCE = Symbol('RATE_LIMITER_INSTANCE');
export const RATE_LIMITER_LOGGER = Symbol('RATE_LIMITER_LOGGER');
export const RATE_LIMITER_METRICS = Symbol('RATE_LIMITER_METRICS');

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly limiterCache = new Map<string, IRateLimiter>();
  private static readonly MAX_CACHE_SIZE = 100;

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(RATE_LIMITER_INSTANCE) private readonly globalLimiter?: IRateLimiter,
    @Optional() @Inject(RATE_LIMITER_LOGGER) private readonly logger?: ILogger,
    @Optional() @Inject(RATE_LIMITER_METRICS) private readonly metrics?: IMetricsRecorder,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) return true;

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      connection?: { remoteAddress?: string };
    }>();
    const key = this.resolveKey(context, options, request);

    const limiter = await this.resolveLimiter(options);
    const result = await limiter.consume(key);

    if (!result.ok) {
      throw new HttpException(
        this.buildErrorBody(result.error, options),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.value.allowed) {
      const retryAfter = Math.ceil((result.value.resetAt - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: options.errorMessage ?? 'Too Many Requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        { cause: new Error('Rate limit exceeded') },
      );
    }

    // Attach rate limit headers
    const response = context.switchToHttp().getResponse();
    response.header('X-RateLimit-Limit', result.value.totalLimit);
    response.header('X-RateLimit-Remaining', result.value.remaining);
    response.header('X-RateLimit-Reset', result.value.resetAt);

    return true;
  }

  /**
   * Resolve the rate limit key for the current request.
   *
   * By default, uses `request.ip` which in Express reflects the client IP.
   * If the application runs behind a reverse proxy (e.g. Nginx, Cloudflare, AWS ALB),
   * you MUST configure Express trust proxy settings so that `request.ip` returns
   * the real client IP from the `X-Forwarded-For` header:
   *
   * ```typescript
   * // main.ts
   * const app = await NestFactory.create(AppModule);
   * app.set('trust proxy', 1); // trust first proxy
   * // or: app.set('trust proxy', true); // trust all (less secure)
   * ```
   *
   * Without trust proxy, `request.ip` will be the proxy's IP address,
   * causing all clients behind the same proxy to share a single rate limit key.
   *
   * @see https://expressjs.com/en/guide/behind-proxies.html
   */
  private resolveKey(
    context: ExecutionContext,
    options: RateLimitOptions,
    request: { ip?: string; connection?: { remoteAddress?: string } },
  ): string {
    if (options.keyGenerator) {
      return options.keyGenerator(context);
    }
    const ip = request.ip ?? request.connection?.remoteAddress ?? 'unknown';
    const prefix = options.keyPrefix ?? '';
    return prefix ? `${prefix}:${ip}` : ip;
  }

  private resolveLimiter(options: RateLimitOptions): IRateLimiter {
    if (!options.algorithm && this.globalLimiter) {
      return this.globalLimiter;
    }

    const cacheKey = this.buildCacheKey(options);
    const cached = this.limiterCache.get(cacheKey);
    if (cached) return cached;

    const config = this.buildConfig(options);
    const limiter = RateLimiterFactory.create(config);
    if (this.limiterCache.size >= RateLimiterGuard.MAX_CACHE_SIZE) {
      const firstKey = this.limiterCache.keys().next().value;
      if (firstKey !== undefined) {
        this.limiterCache.delete(firstKey);
      }
    }
    this.limiterCache.set(cacheKey, limiter);
    return limiter;
  }

  private buildConfig(options: RateLimitOptions): RateLimiterConfig {
    const algorithm: AlgorithmType = options.algorithm ?? 'token-bucket';
    const base: RateLimiterConfig = {
      algorithm,
      store: 'memory',
      keyPrefix: options.keyPrefix,
      logger: this.logger,
      metrics: this.metrics,
    };

    return Object.assign(base, this.extractAlgoConfig(algorithm, options));
  }

  private extractAlgoConfig(
    _algorithm: AlgorithmType,
    options: RateLimitOptions,
  ): Record<string, unknown> {
    const excluded = new Set(['algorithm', 'keyGenerator', 'errorMessage', 'keyPrefix']);
    return Object.fromEntries(
      Object.entries(options as unknown as Record<string, unknown>).filter(([k]) => !excluded.has(k)),
    );
  }

  private buildCacheKey(options: RateLimitOptions): string {
    const excluded = new Set(['keyGenerator', 'errorMessage']);
    const serializable = Object.fromEntries(
      Object.entries(options as unknown as Record<string, unknown>).filter(([k]) => !excluded.has(k)),
    );
    return JSON.stringify(serializable);
  }

  private buildErrorBody(
    _error: RateLimitError,
    _options: RateLimitOptions,
  ): { statusCode: number; message: string } {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Rate limiter unavailable',
    };
  }
}
