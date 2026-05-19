import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';

export type IdempotencyStatus = 'pending' | 'completed';

export type IdempotencyStrategy = 'replay' | 'reject';

export interface IdempotencyRecord {
  key:           string;
  status:        IdempotencyStatus;
  statusCode:    number;
  body:          unknown;
  correlationId: string | undefined;
  createdAt:     number;
  completedAt:   number | undefined;
}

export interface IdempotencyModuleOptions {
  /** Default TTL in seconds for idempotency records. Default: 86400 (24 h). */
  ttlSeconds?: number;
  /**
   * What to do when a request arrives while an identical request is still in-flight.
   *   - 'reject'  → 409 ConflictException (default)
   *   - 'replay'  → 202 Accepted + Retry-After: 1
   */
  pendingStrategy?: IdempotencyStrategy;
  /** Header name to read the idempotency key from. Default: 'idempotency-key'. */
  keyHeader?: string;
}

export interface IdempotentOptions {
  /** Per-endpoint TTL override in seconds. Falls back to module default. */
  ttlSeconds?: number;
  /** Per-endpoint pending strategy override. Falls back to module default. */
  pendingStrategy?: IdempotencyStrategy;
}

export interface IdempotencyModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: unknown[]) => Promise<IdempotencyModuleOptions> | IdempotencyModuleOptions;
  inject?:    (InjectionToken | OptionalFactoryDependency)[];
  useClass?:  Type<IdempotencyOptionsFactory>;
  useExisting?: Type<IdempotencyOptionsFactory>;
}

export interface IdempotencyOptionsFactory {
  createIdempotencyOptions(): Promise<IdempotencyModuleOptions> | IdempotencyModuleOptions;
}
