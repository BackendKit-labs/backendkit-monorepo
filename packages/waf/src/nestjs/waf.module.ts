import { DynamicModule, Module } from '@nestjs/common';
import { WafScanner } from '../core/scanner.js';
import { SanitizePipe } from './sanitize.pipe.js';
import { WafMiddleware } from './waf.middleware.js';
import { WAF_OPTIONS, type WafModuleOptions } from './waf.options.js';

/**
 * @example
 * // app.module.ts
 * import { WafModule } from '@backendkit-labs/waf/nestjs';
 *
 * @Module({
 *   imports: [WafModule.forRoot({ mode: 'block', excludePaths: ['/health'] })],
 * })
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(WafMiddleware).forRoutes('*');
 *   }
 * }
 */
@Module({})
export class WafModule {
  static forRoot(options: WafModuleOptions = {}): DynamicModule {
    const optionsProvider = {
      provide:  WAF_OPTIONS,
      useValue: options,
    };

    const scannerProvider = {
      provide:    WafScanner,
      useFactory: (opts: WafModuleOptions) =>
        new WafScanner({
          rules:           opts.rules,
          customRules:     opts.customRules,
          maxDepth:        opts.maxDepth,
          maxStringLength: opts.maxStringLength,
        }),
      inject: [WAF_OPTIONS],
    };

    return {
      module:    WafModule,
      global:    true,
      providers: [optionsProvider, scannerProvider, WafMiddleware, SanitizePipe],
      exports:   [WafScanner, WafMiddleware, SanitizePipe],
    };
  }
}
