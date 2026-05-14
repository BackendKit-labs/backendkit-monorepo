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
  useFactory?: (...args: unknown[]) => Promise<HttpClientModuleOptions> | HttpClientModuleOptions;
  useClass?:   Type<HttpClientOptionsFactory>;
  useExisting?: Type<HttpClientOptionsFactory>;
  inject?:     (InjectionToken | OptionalFactoryDependency)[];
}
