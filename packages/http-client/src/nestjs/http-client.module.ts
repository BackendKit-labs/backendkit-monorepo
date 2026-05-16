import { Module, DynamicModule, Provider } from '@nestjs/common';
import type { Type, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import { HttpClient } from '../core/http-client.js';
import type { HttpClientConfig, HttpClientToken } from '../core/types.js';
import type {
  HttpClientModuleOptions,
  HttpClientModuleAsyncOptions,
  HttpClientOptionsFactory,
} from './http-client.options.js';

const HTTP_CLIENT_MODULE_OPTIONS = 'HTTP_CLIENT_MODULE_OPTIONS';

@Module({})
export class HttpClientModule {
  static forRoot(options: HttpClientModuleOptions): DynamicModule {
    const providers: Provider[] = options.clients.map(({ token, config }) =>
      HttpClientModule._clientProvider(token, config),
    );

    return {
      module:   HttpClientModule,
      providers,
      exports:  providers,
      global:   true,
    };
  }

  static forRootAsync(options: HttpClientModuleAsyncOptions): DynamicModule {
    const asyncProvider = HttpClientModule._asyncOptionsProvider(options);

    const clientProviders: Provider[] = options.clients.map(token => ({
      provide:    token.symbol,
      useFactory: (opts: HttpClientModuleOptions) => {
        const def = opts.clients.find(c => c.token.symbol === token.symbol);
        if (!def) throw new Error(
          `HttpClient config not found for '${token.description}'. ` +
          `The factory must return a config entry for every token declared in 'clients'.`,
        );
        return new HttpClient(def.config);
      },
      inject: [HTTP_CLIENT_MODULE_OPTIONS],
    }));

    const allProviders: Provider[] = [asyncProvider, ...clientProviders];

    return {
      module:   HttpClientModule,
      imports:  options.imports ?? [],
      providers: allProviders,
      exports:  allProviders,
      global:   true,
    };
  }

  private static _clientProvider(token: HttpClientToken, config: HttpClientConfig): Provider {
    return {
      provide:    token.symbol,
      useFactory: () => new HttpClient(config),
    };
  }

  private static _asyncOptionsProvider(options: HttpClientModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide:    HTTP_CLIENT_MODULE_OPTIONS,
        useFactory: options.useFactory as (...args: unknown[]) => HttpClientModuleOptions | Promise<HttpClientModuleOptions>,
        inject:     (options.inject ?? []) as (InjectionToken | OptionalFactoryDependency)[],
      };
    }

    const cls = options.useExisting ?? options.useClass;
    if (cls) {
      return {
        provide:    HTTP_CLIENT_MODULE_OPTIONS,
        useFactory: (factory: HttpClientOptionsFactory) => factory.createHttpClientOptions(),
        inject:     [cls as Type<HttpClientOptionsFactory>],
      };
    }

    return {
      provide:  HTTP_CLIENT_MODULE_OPTIONS,
      useValue: { clients: [] } satisfies HttpClientModuleOptions,
    };
  }
}
