import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  CircuitBreakerGuard,
  UseCircuitBreaker,
  CircuitBreakerRequestInfo,
} from '../../src/nestjs/circuit-breaker.guard.js';
import { CircuitBreakerRegistry } from '../../src/circuit-breaker/circuit-breaker.registry.js';

// Emulates TypeScript's `__decorate` helper for a method decorator compiled
// with `experimentalDecorators` -- lets us apply `@UseCircuitBreaker(...)`
// the same way `tsc` would, without needing a full compiled fixture class.
function applyMethodDecorator(
  decorator: MethodDecorator,
  target: object,
  key: string,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
  const result = decorator(target, key, descriptor) as PropertyDescriptor | undefined;
  Object.defineProperty(target, key, result ?? descriptor);
}

function makeContext(handler: () => unknown, request: Record<string, unknown> = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('UseCircuitBreaker + CircuitBreakerGuard', () => {
  let registry: CircuitBreakerRegistry;
  let guard: CircuitBreakerGuard;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
    guard = new CircuitBreakerGuard(new Reflector(), registry);
  });

  it('attaches readable metadata to the decorated handler', () => {
    class Controller {
      handler() { return 'ok'; }
    }
    applyMethodDecorator(
      UseCircuitBreaker({ name: 'stripe-api', failureThreshold: 40 }) as MethodDecorator,
      Controller.prototype,
      'handler',
    );

    // Regression guard for the original bug: metadata must NOT be reachable
    // under the old hardcoded string key -- it lives under the reflectable
    // decorator's own generated key now.
    const meta = new Reflector().get<{ name: string } | undefined>('circuit-breaker', Controller.prototype.handler);
    expect(meta).toBeUndefined();

    // The real contract: canActivate must actually find it.
    const ctx = makeContext(Controller.prototype.handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the request through when there is no @UseCircuitBreaker on the handler', () => {
    const ctx = makeContext(function undecorated() {});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the request through and attaches CircuitBreakerRequestInfo when CLOSED', () => {
    class Controller {
      handler() { return 'ok'; }
    }
    applyMethodDecorator(
      UseCircuitBreaker({ name: 'svc-a' }) as MethodDecorator,
      Controller.prototype,
      'handler',
    );

    const request: Record<string, unknown> = {};
    const ctx = makeContext(Controller.prototype.handler, request);
    expect(guard.canActivate(ctx)).toBe(true);

    const info = request['circuitBreaker'] as CircuitBreakerRequestInfo;
    expect(info).toEqual({ name: 'svc-a', state: 'closed', canAttempt: true });
  });

  it('throws ServiceUnavailableException once the named circuit is OPEN', async () => {
    class Controller {
      handler() { return 'ok'; }
    }
    applyMethodDecorator(
      UseCircuitBreaker({ name: 'svc-b', failureThreshold: 1 }) as MethodDecorator,
      Controller.prototype,
      'handler',
    );

    const cb = registry.getOrCreate({ name: 'svc-b', failureThreshold: 1, minimumCalls: 1 });
    await cb.execute(() => Promise.reject(new Error('boom'))).catch(() => {});
    expect(cb.getState()).toBe('open');

    const ctx = makeContext(Controller.prototype.handler);
    expect(() => guard.canActivate(ctx)).toThrow(ServiceUnavailableException);
  });

  it('two routes sharing the same name share circuit state', async () => {
    class Controller {
      routeA() { return 'a'; }
      routeB() { return 'b'; }
    }
    applyMethodDecorator(UseCircuitBreaker({ name: 'shared', failureThreshold: 1 }) as MethodDecorator, Controller.prototype, 'routeA');
    applyMethodDecorator(UseCircuitBreaker({ name: 'shared', failureThreshold: 1 }) as MethodDecorator, Controller.prototype, 'routeB');

    const cb = registry.getOrCreate({ name: 'shared', failureThreshold: 1, minimumCalls: 1 });
    await cb.execute(() => Promise.reject(new Error('boom'))).catch(() => {});

    expect(() => guard.canActivate(makeContext(Controller.prototype.routeA))).toThrow(ServiceUnavailableException);
    expect(() => guard.canActivate(makeContext(Controller.prototype.routeB))).toThrow(ServiceUnavailableException);
  });
});
