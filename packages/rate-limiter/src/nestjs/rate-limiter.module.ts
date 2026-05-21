import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  RateLimiterGuard,
  RATE_LIMITER_INSTANCE,
  RATE_LIMITER_LOGGER,
  RATE_LIMITER_METRICS,
} from './rate-limiter.guard';
import { RateLimiterFactory } from '../factory';
import { RateLimiterConfig } from '../interfaces/config.interface';
import { ILogger } from '../interfaces/logger.interface';
import { IMetricsRecorder } from '../interfaces/metrics.interface';

export interface RateLimiterModuleOptions {
  config?: RateLimiterConfig;
  globalGuard?: boolean;
  /** Optional logger injected into the guard and all per-route limiters it creates */
  logger?: ILogger;
  /** Optional metrics recorder injected into the guard and all per-route limiters it creates */
  metrics?: IMetricsRecorder;
}

export interface RateLimiterModuleAsyncOptions {
  imports?: Type<unknown>[];
  useFactory: (...args: unknown[]) => RateLimiterConfig | Promise<RateLimiterConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  globalGuard?: boolean;
  /** Optional logger injected into the guard and all per-route limiters it creates */
  logger?: ILogger;
  /** Optional metrics recorder injected into the guard and all per-route limiters it creates */
  metrics?: IMetricsRecorder;
}

@Module({})
export class RateLimiterModule {
  /**
   * Configure the rate limiter synchronously.
   * If config is provided, a global IRateLimiter instance is created and
   * injected into the guard. The module also exports the guard.
   *
   * **Note about IP-based rate limiting behind a proxy:**
   * When using the default key generator (based on `request.ip`), you MUST
   * configure Express trust proxy settings in your main.ts if your app runs
   * behind a reverse proxy (Nginx, Cloudflare, AWS ALB, etc.):
   *
   * ```typescript
   * const app = await NestFactory.create(AppModule);
   * app.set('trust proxy', 1);
   * ```
   *
   * Without this, all clients behind the same proxy will share a single
   * rate limit key because `request.ip` will return the proxy's IP.
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     RateLimiterModule.forRoot({
   *       config: {
   *         algorithm: 'token-bucket',
   *         store: 'memory',
   *         tokensPerSecond: 10,
   *         bucketSize: 20,
   *       },
   *       globalGuard: true,
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot(options?: RateLimiterModuleOptions): DynamicModule {
    const providers: Provider[] = [];

    if (options?.config) {
      const configWithObservability: RateLimiterConfig = {
        ...options.config,
        logger: options.config.logger ?? options.logger,
        metrics: options.config.metrics ?? options.metrics,
      };
      providers.push({
        provide: RATE_LIMITER_INSTANCE,
        useValue: RateLimiterFactory.create(configWithObservability),
      });
    }

    if (options?.logger) {
      providers.push({ provide: RATE_LIMITER_LOGGER, useValue: options.logger });
    }

    if (options?.metrics) {
      providers.push({ provide: RATE_LIMITER_METRICS, useValue: options.metrics });
    }

    if (options?.globalGuard !== false) {
      providers.push({
        provide: APP_GUARD,
        useClass: RateLimiterGuard,
      });
    }

    return {
      module: RateLimiterModule,
      providers,
      exports: [RATE_LIMITER_INSTANCE, RateLimiterGuard],
    };
  }

  /**
   * Configure the rate limiter asynchronously.
   * Useful when config depends on environment variables or async providers.
   *
   * @example
   * ```typescript
   * // With @backendkit-labs/observability
   * @Module({
   *   imports: [
   *     ObservabilityModule.forRoot({ serviceName: 'my-api' }),
   *     ConfigModule,
   *     RateLimiterModule.forRootAsync({
   *       imports: [ObservabilityModule, ConfigModule],
   *       useFactory: (config: ConfigService, logger: LoggerService, metrics: MetricsService) => ({
   *         algorithm: 'sliding-window-counter',
   *         store: 'redis',
   *         windowMs: config.get('RATE_LIMIT_WINDOW_MS'),
   *         maxRequests: config.get('RATE_LIMIT_MAX'),
   *         circuitBreaker: { failureThreshold: 60, fallbackToMemory: true },
   *         logger,
   *         metrics,
   *       }),
   *       inject: [ConfigService, LoggerService, MetricsService],
   *       globalGuard: true,
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRootAsync(options: RateLimiterModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: RATE_LIMITER_INSTANCE,
        useFactory: async (...args: unknown[]) => {
          const config = await options.useFactory(...args);
          return RateLimiterFactory.create(config);
        },
        inject: options.inject ?? [],
      },
    ];

    if (options.logger) {
      providers.push({ provide: RATE_LIMITER_LOGGER, useValue: options.logger });
    }

    if (options.metrics) {
      providers.push({ provide: RATE_LIMITER_METRICS, useValue: options.metrics });
    }

    if (options.globalGuard !== false) {
      providers.push({
        provide: APP_GUARD,
        useClass: RateLimiterGuard,
      });
    }

    return {
      module: RateLimiterModule,
      imports: options.imports ?? [],
      providers,
      exports: [RATE_LIMITER_INSTANCE, RateLimiterGuard],
    };
  }
}
