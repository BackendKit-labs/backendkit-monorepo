import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, firstValueFrom }        from 'rxjs';
import type { ExecutionContext, CallHandler }     from '@nestjs/common';
import { Reflector }                             from '@nestjs/core';

import { IdempotencyInterceptor }       from '../../src/interceptors/idempotency.interceptor.js';
import { InMemoryIdempotencyStore }     from '../../src/store/in-memory.store.js';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_META_KEY,
  IDEMPOTENCY_REPLAYED_HEADER,
} from '../../src/idempotency.constants.js';
import {
  IdempotencyKeyMissingError,
  IdempotencyKeyInvalidError,
  IdempotencyPendingConflictError,
} from '../../src/idempotency.errors.js';
import type { IdempotencyModuleOptions, IdempotentOptions } from '../../src/idempotency.types.js';

// ── helpers ───────────────────────────────────────────────────────────────────

interface FakeRequest {
  method:  string;
  path:    string;
  headers: Record<string, string | undefined>;
}

interface FakeResponse {
  statusCode: number;
  headers:    Record<string, string>;
  status(code: number): this;
  setHeader(name: string, value: string): this;
}

function makeCtx(
  req: FakeRequest,
  metadata: IdempotentOptions | undefined,
  reflector: Reflector,
): ExecutionContext {
  const res: FakeResponse = {
    statusCode: 201,
    headers:    {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };

  vi.spyOn(reflector, 'get').mockReturnValue(metadata);

  return {
    getHandler: () => ({}),
    switchToHttp: () => ({
      getRequest:  () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(body: unknown = { id: 'order-1' }): CallHandler {
  return { handle: () => of(body) };
}

function makeInterceptor(
  opts: IdempotencyModuleOptions = {},
  store = new InMemoryIdempotencyStore(),
) {
  const reflector = new Reflector();
  const interceptor = new IdempotencyInterceptor(reflector, store, opts);
  return { interceptor, reflector, store };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('IdempotencyInterceptor — pass-through', () => {
  it('passes through when @Idempotent() metadata is absent', async () => {
    const { interceptor, reflector } = makeInterceptor();
    const req = { method: 'POST', path: '/orders', headers: {} };
    const ctx = makeCtx(req, undefined, reflector);

    const obs = await interceptor.intercept(ctx, makeHandler('response'));
    const result = await firstValueFrom(obs);
    expect(result).toBe('response');
  });
});

describe('IdempotencyInterceptor — key validation', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector:   Reflector;

  beforeEach(() => {
    ({ interceptor, reflector } = makeInterceptor());
  });

  it('throws 422 when Idempotency-Key header is missing', async () => {
    const req = { method: 'POST', path: '/orders', headers: {} };
    const ctx = makeCtx(req, {}, reflector);
    await expect(interceptor.intercept(ctx, makeHandler())).rejects.toThrow(IdempotencyKeyMissingError);
  });

  it('throws 422 when key exceeds 256 characters', async () => {
    const req = {
      method: 'POST',
      path:   '/orders',
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'x'.repeat(300) },
    };
    const ctx = makeCtx(req, {}, reflector);
    await expect(interceptor.intercept(ctx, makeHandler())).rejects.toThrow(IdempotencyKeyInvalidError);
  });

  it('throws 422 when key contains non-printable characters', async () => {
    const req = {
      method: 'POST',
      path:   '/orders',
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'bad\x00key' },
    };
    const ctx = makeCtx(req, {}, reflector);
    await expect(interceptor.intercept(ctx, makeHandler())).rejects.toThrow(IdempotencyKeyInvalidError);
  });

  it('accepts a valid printable key of exactly 256 chars', async () => {
    const req = {
      method:  'POST',
      path:    '/orders',
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'a'.repeat(256) },
    };
    const ctx = makeCtx(req, {}, reflector);
    await expect(interceptor.intercept(ctx, makeHandler())).resolves.toBeDefined();
  });
});

describe('IdempotencyInterceptor — first request (cache miss)', () => {
  it('executes handler and returns its response', async () => {
    const { interceptor, reflector } = makeInterceptor();
    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const ctx = makeCtx(req, {}, reflector);

    const obs    = await interceptor.intercept(ctx, makeHandler({ id: 'order-1' }));
    const result = await firstValueFrom(obs);
    expect(result).toEqual({ id: 'order-1' });
  });

  it('persists a completed record in the store after handler resolves', async () => {
    const { interceptor, reflector, store } = makeInterceptor();
    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const ctx = makeCtx(req, {}, reflector);

    const obs = await interceptor.intercept(ctx, makeHandler({ id: 'order-1' }));
    await firstValueFrom(obs);

    const saved = await store.get('POST:/orders:key-1');
    expect(saved!.status).toBe('completed');
    expect(saved!.body).toEqual({ id: 'order-1' });
  });

  it('deletes the key from the store when handler throws', async () => {
    const { interceptor, reflector, store } = makeInterceptor();
    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const ctx = makeCtx(req, {}, reflector);
    const failHandler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    const obs = await interceptor.intercept(ctx, failHandler);
    await expect(firstValueFrom(obs)).rejects.toThrow('boom');

    expect(await store.get('POST:/orders:key-1')).toBeNull();
  });
});

describe('IdempotencyInterceptor — replay (cache hit, completed)', () => {
  it('replays the cached response without calling the handler', async () => {
    const store = new InMemoryIdempotencyStore();
    const { interceptor, reflector } = makeInterceptor({}, store);

    // Seed a completed record
    await store.setIfAbsent(
      { key: 'POST:/orders:key-1', status: 'completed', statusCode: 201,
        body: { id: 'cached-order' }, correlationId: undefined, createdAt: Date.now(), completedAt: Date.now() },
      3600,
    );

    const handlerSpy = vi.fn(() => of({ id: 'new-order' }));
    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const ctx = makeCtx(req, {}, reflector);

    const obs    = await interceptor.intercept(ctx, { handle: handlerSpy });
    const result = await firstValueFrom(obs);

    expect(handlerSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'cached-order' });
  });

  it('sets Idempotent-Replayed: true header on replay', async () => {
    const store = new InMemoryIdempotencyStore();
    const { interceptor, reflector } = makeInterceptor({}, store);

    await store.setIfAbsent(
      { key: 'POST:/orders:key-1', status: 'completed', statusCode: 201,
        body: { id: 'cached-order' }, correlationId: undefined, createdAt: Date.now(), completedAt: Date.now() },
      3600,
    );

    const req: FakeRequest = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const res: FakeResponse = {
      statusCode: 200, headers: {},
      status(c) { this.statusCode = c; return this; },
      setHeader(n, v) { this.headers[n] = v; return this; },
    };

    vi.spyOn(reflector, 'get').mockReturnValue({} as IdempotentOptions);
    const ctx = {
      getHandler:   () => ({}),
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;

    const obs = await interceptor.intercept(ctx, makeHandler());
    await firstValueFrom(obs);

    expect(res.headers[IDEMPOTENCY_REPLAYED_HEADER]).toBe('true');
    expect(res.statusCode).toBe(201);
  });
});

describe('IdempotencyInterceptor — pending conflict', () => {
  it('throws 409 when strategy=reject and request is pending', async () => {
    const store = new InMemoryIdempotencyStore();
    const { interceptor, reflector } = makeInterceptor({ pendingStrategy: 'reject' }, store);

    await store.setIfAbsent(
      { key: 'POST:/orders:key-1', status: 'pending', statusCode: 0,
        body: null, correlationId: undefined, createdAt: Date.now(), completedAt: undefined },
      3600,
    );

    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const ctx = makeCtx(req, {}, reflector);

    await expect(interceptor.intercept(ctx, makeHandler())).rejects.toThrow(IdempotencyPendingConflictError);
  });

  it('returns 202 + Retry-After when strategy=replay and request is pending', async () => {
    const store = new InMemoryIdempotencyStore();
    const { interceptor, reflector } = makeInterceptor({ pendingStrategy: 'replay' }, store);

    await store.setIfAbsent(
      { key: 'POST:/orders:key-1', status: 'pending', statusCode: 0,
        body: null, correlationId: undefined, createdAt: Date.now(), completedAt: undefined },
      3600,
    );

    const req: FakeRequest  = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const res: FakeResponse = {
      statusCode: 200, headers: {},
      status(c) { this.statusCode = c; return this; },
      setHeader(n, v) { this.headers[n] = v; return this; },
    };
    vi.spyOn(reflector, 'get').mockReturnValue({} as IdempotentOptions);
    const ctx = {
      getHandler:   () => ({}),
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;

    const obs = await interceptor.intercept(ctx, makeHandler());
    await firstValueFrom(obs);

    expect(res.statusCode).toBe(202);
    expect(res.headers['Retry-After']).toBe('1');
  });
});

describe('IdempotencyInterceptor — per-endpoint overrides', () => {
  it('uses per-endpoint ttlSeconds when provided', async () => {
    const store      = new InMemoryIdempotencyStore();
    const completeSpy = vi.spyOn(store, 'complete');
    const { interceptor, reflector } = makeInterceptor({ ttlSeconds: 3600 }, store);

    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    // endpoint overrides ttl to 60
    const ctx = makeCtx(req, { ttlSeconds: 60 }, reflector);

    const obs = await interceptor.intercept(ctx, makeHandler());
    await firstValueFrom(obs);

    expect(completeSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.anything(), 60);
  });

  it('uses module-level ttlSeconds when endpoint provides none', async () => {
    const store      = new InMemoryIdempotencyStore();
    const completeSpy = vi.spyOn(store, 'complete');
    const { interceptor, reflector } = makeInterceptor({ ttlSeconds: 7200 }, store);

    const req = { method: 'POST', path: '/orders', headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-1' } };
    const ctx = makeCtx(req, {}, reflector);  // no endpoint-level ttl

    const obs = await interceptor.intercept(ctx, makeHandler());
    await firstValueFrom(obs);

    expect(completeSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.anything(), 7200);
  });
});

describe('IdempotencyInterceptor — composite key isolation', () => {
  it('treats same client key on different paths as distinct records', async () => {
    const store = new InMemoryIdempotencyStore();
    const { interceptor, reflector } = makeInterceptor({}, store);

    for (const path of ['/orders', '/payments']) {
      const req = { method: 'POST', path, headers: { [IDEMPOTENCY_KEY_HEADER]: 'same-key' } };
      const ctx = makeCtx(req, {}, reflector);
      const obs = await interceptor.intercept(ctx, makeHandler({ path }));
      await firstValueFrom(obs);
    }

    const orderRec   = await store.get('POST:/orders:same-key');
    const paymentRec = await store.get('POST:/payments:same-key');
    expect(orderRec).not.toBeNull();
    expect(paymentRec).not.toBeNull();
    expect((orderRec!.body as { path: string }).path).toBe('/orders');
    expect((paymentRec!.body as { path: string }).path).toBe('/payments');
  });
});
