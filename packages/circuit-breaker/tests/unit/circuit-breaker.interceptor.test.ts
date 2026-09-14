import { describe, it, expect } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreakerInterceptor } from '../../src/nestjs/circuit-breaker.interceptor.js';
import { CircuitBreakerRegistry } from '../../src/circuit-breaker/circuit-breaker.registry.js';

function makeContext(className: string, handlerName: string): ExecutionContext {
  const handler = { [handlerName]: function () {} }[handlerName];
  return {
    getHandler: () => handler,
    getClass: () => ({ name: className }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

function handlerThrowing(error: unknown): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe('CircuitBreakerInterceptor', () => {
  it('creates one circuit per handler, named handler:Class.method', async () => {
    const registry = new CircuitBreakerRegistry();
    const interceptor = new CircuitBreakerInterceptor(registry);
    const ctx = makeContext('ReportsController', 'findAll');

    const obs = await interceptor.intercept(ctx, handlerReturning('ok'));
    await expect(firstValueFrom(obs)).resolves.toBe('ok');

    expect(Object.keys(registry.getAllMetrics())).toEqual(['handler:ReportsController.findAll']);
  });

  it('throws ServiceUnavailableException once the handler circuit is OPEN', async () => {
    const registry = new CircuitBreakerRegistry();
    const interceptor = new CircuitBreakerInterceptor(registry);
    const ctx = makeContext('PaymentsController', 'charge');

    // isHttpServerError treats a plain Error (no getStatus) as infrastructure.
    for (let i = 0; i < 5; i++) {
      await expect(interceptor.intercept(ctx, handlerThrowing(new Error('boom'))))
        .rejects.toThrow(Error);
    }

    await expect(interceptor.intercept(ctx, handlerReturning('unreachable')))
      .rejects.toThrow(ServiceUnavailableException);
  });

  it('4xx-style business errors (getStatus) do not open the circuit', async () => {
    const registry = new CircuitBreakerRegistry();
    const interceptor = new CircuitBreakerInterceptor(registry);
    const ctx = makeContext('OrdersController', 'get');
    const notFound = { getStatus: () => 404 };

    for (let i = 0; i < 10; i++) {
      await expect(interceptor.intercept(ctx, handlerThrowing(notFound))).rejects.toBe(notFound);
    }

    expect(registry.getAllMetrics()['handler:OrdersController.get'].state).toBe('closed');
  });
});
