import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector }          from '@nestjs/core';
import { Observable, catchError, from, map, mergeMap } from 'rxjs';
import type { Request, Response } from 'express';

import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_META_KEY,
  IDEMPOTENCY_OPTIONS,
  IDEMPOTENCY_REPLAYED_HEADER,
  IDEMPOTENCY_STORE,
} from '../idempotency.constants.js';
import {
  IdempotencyKeyInvalidError,
  IdempotencyKeyMissingError,
  IdempotencyPendingConflictError,
} from '../idempotency.errors.js';
import type { IdempotencyModuleOptions, IdempotentOptions } from '../idempotency.types.js';
import type { IdempotencyStore }                            from '../store/idempotency-store.interface.js';

const SAFE_KEY = /^[\x20-\x7E]{1,256}$/;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(IDEMPOTENCY_STORE)
    private readonly store: IdempotencyStore,
    @Inject(IDEMPOTENCY_OPTIONS)
    private readonly opts: IdempotencyModuleOptions,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const endpointOpts = this.reflector.get<IdempotentOptions | undefined>(
      IDEMPOTENCY_META_KEY,
      ctx.getHandler(),
    );

    // Route not decorated with @Idempotent() — pass through
    if (endpointOpts === undefined) return next.handle();

    const http = ctx.switchToHttp();
    const req  = http.getRequest<Request>();
    const res  = http.getResponse<Response>();

    const keyHeader = this.opts.keyHeader ?? IDEMPOTENCY_KEY_HEADER;
    const rawKey    = req.headers[keyHeader];

    if (!rawKey || Array.isArray(rawKey)) {
      throw new IdempotencyKeyMissingError(keyHeader);
    }
    if (!SAFE_KEY.test(rawKey)) {
      throw new IdempotencyKeyInvalidError(keyHeader);
    }

    const ttl             = endpointOpts.ttlSeconds ?? this.opts.ttlSeconds ?? 86_400;
    const pendingStrategy = endpointOpts.pendingStrategy ?? this.opts.pendingStrategy ?? 'reject';

    // Composite key: method + path + client-supplied key
    const compositeKey = `${req.method}:${req.path}:${rawKey}`;
    const correlationId = (req as Request & { correlationId?: string }).correlationId;

    const existing = await this.store.get(compositeKey);

    if (existing) {
      if (existing.status === 'completed') {
        res.status(existing.statusCode);
        res.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
        return new Observable(subscriber => {
          subscriber.next(existing.body);
          subscriber.complete();
        });
      }

      // pending
      if (pendingStrategy === 'replay') {
        res.status(202);
        res.setHeader('Retry-After', '1');
        return new Observable(subscriber => {
          subscriber.next({ message: 'Request in progress, retry shortly' });
          subscriber.complete();
        });
      }
      throw new IdempotencyPendingConflictError(rawKey);
    }

    // First time — atomically claim the key
    const claimed = await this.store.setIfAbsent(
      {
        key:           compositeKey,
        status:        'pending',
        statusCode:    0,
        body:          null,
        correlationId,
        createdAt:     Date.now(),
        completedAt:   undefined,
      },
      ttl,
    );

    if (claimed) {
      // Lost the race — another request already claimed this key between our get() and setIfAbsent()
      if (claimed.status === 'completed') {
        res.status(claimed.statusCode);
        res.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
        return new Observable(subscriber => {
          subscriber.next(claimed.body);
          subscriber.complete();
        });
      }
      if (pendingStrategy === 'replay') {
        res.status(202);
        res.setHeader('Retry-After', '1');
        return new Observable(subscriber => {
          subscriber.next({ message: 'Request in progress, retry shortly' });
          subscriber.complete();
        });
      }
      throw new IdempotencyPendingConflictError(rawKey);
    }

    // tap() doesn't await async callbacks — use mergeMap to properly await store updates
    return next.handle().pipe(
      mergeMap((body: unknown) =>
        from(this.store.complete(compositeKey, res.statusCode, body, ttl)).pipe(
          map(() => body),
        ),
      ),
      catchError((err: unknown) =>
        from(this.store.delete(compositeKey)).pipe(
          mergeMap(() => { throw err as Error; }),
        ),
      ),
    );
  }
}
