import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { of, lastValueFrom } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { RetryModule } from '../../src/nestjs/retry.module.js';
import { RetryInterceptor } from '../../src/nestjs/retry.interceptor.js';
import { RetryService } from '../../src/nestjs/retry.service.js';
import { Retry } from '../../src/nestjs/retry.decorator.js';

function findGlobalInterceptor(container: ModulesContainer): RetryInterceptor | undefined {
  for (const mod of container.values()) {
    for (const wrapper of mod.providers.values()) {
      if (wrapper.metatype === RetryInterceptor) return wrapper.instance as RetryInterceptor;
    }
  }
  return undefined;
}

function makeContext(handler: (...args: unknown[]) => unknown): ExecutionContext {
  return { getHandler: () => handler, getClass: () => class {} } as unknown as ExecutionContext;
}

describe('RetryInterceptor (real Nest DI)', () => {
  it('RetryModule.forRoot({ globalInterceptor: true }) resolves reflector and RetryService via DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RetryModule.forRoot({ globalInterceptor: true })],
    }).compile();

    const interceptor = findGlobalInterceptor(moduleRef.get(ModulesContainer));
    expect(interceptor).toBeDefined();

    // Regression guard for the bug this fixes: without @Inject(), tsup's
    // build doesn't emit design:paramtypes, so Nest's DI container passed
    // no constructor arguments at all -- both fields stayed undefined and
    // every intercepted request threw on `this.reflector.get(...)`.
    const ctx = makeContext(function plainRoute() {});
    const handler: CallHandler = { handle: () => of('route response') };
    await expect(lastValueFrom(interceptor!.intercept(ctx, handler))).resolves.toBe('route response');

    await moduleRef.close();
  });

  it('RetryModule.forRoot() (no options) does not register a global interceptor by default', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RetryModule.forRoot()],
    }).compile();

    expect(findGlobalInterceptor(moduleRef.get(ModulesContainer))).toBeUndefined();
    // RetryService must still work without the interceptor.
    const svc = moduleRef.get(RetryService);
    const result = await svc.execute(() => Promise.resolve('ok'), { maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } });
    expect(result.ok).toBe(true);

    await moduleRef.close();
  });
});

describe('@Retry (direct method wrapping)', () => {
  it('retries a plain @Injectable() service method without any interceptor', async () => {
    class InventoryService {
      calls = 0;
      @Retry({ maxAttempts: 3, backoff: { type: 'fixed', baseDelay: 0 } })
      async reserveStock() {
        this.calls++;
        if (this.calls < 2) throw Object.assign(new Error('inventory down'), { status: 503 });
        return 'reserved';
      }
    }

    const svc = new InventoryService();
    await expect(svc.reserveStock()).resolves.toBe('reserved');
    expect(svc.calls).toBe(2);
  });

  it('rethrows the original error once retries are exhausted', async () => {
    class FlakyService {
      @Retry({ maxAttempts: 2, backoff: { type: 'fixed', baseDelay: 0 } })
      async alwaysFails() {
        throw Object.assign(new Error('down'), { status: 503 });
      }
    }

    await expect(new FlakyService().alwaysFails()).rejects.toThrow('down');
  });

  it('preserves `this` and forwards arguments to the wrapped method', async () => {
    class Calculator {
      base = 10;
      @Retry({ maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } })
      async add(n: number) {
        return this.base + n;
      }
    }

    await expect(new Calculator().add(5)).resolves.toBe(15);
  });

  it('uses an injected retryRegistry when present, instead of the internal default one', async () => {
    const { RetryRegistry } = await import('../../src/retry/retry.registry.js');
    class Svc {
      readonly retryRegistry = new RetryRegistry();
      @Retry({ maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } })
      async ping() { return 'pong'; }
    }
    const svc = new Svc();
    await svc.ping();
    // A named engine was created on the injected registry -- proves the
    // decorator used it instead of (or in addition to) the internal default.
    expect(Object.keys(svc.retryRegistry.getAllMetrics())).toHaveLength(1);
  });
});
