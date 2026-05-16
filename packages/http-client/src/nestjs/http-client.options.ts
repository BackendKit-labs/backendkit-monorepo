import type { ModuleMetadata, Type, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import type { HttpClientConfig } from '../core/types.js';
import type { HttpClientToken } from '../core/types.js';

export interface HttpClientDefinition {
  token:  HttpClientToken;
  config: HttpClientConfig;
}

export interface HttpClientModuleOptions {
  clients: HttpClientDefinition[];
}

export interface HttpClientOptionsFactory {
  createHttpClientOptions(): Promise<HttpClientModuleOptions> | HttpClientModuleOptions;
}

export interface HttpClientModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Declare the client tokens that the factory will configure.
   * Each token listed here gets its own provider, so `@InjectHttpClient(token)` works.
   * The factory must return a config entry for every token declared here.
   */
  clients: HttpClientToken[];
  useFactory?: (...args: unknown[]) => Promise<HttpClientModuleOptions> | HttpClientModuleOptions;
  useClass?:   Type<HttpClientOptionsFactory>;
  useExisting?: Type<HttpClientOptionsFactory>;
  inject?:     (InjectionToken | OptionalFactoryDependency)[];
}
