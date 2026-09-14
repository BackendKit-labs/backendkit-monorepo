import { describe, it, expect } from 'vitest';
import { WithCircuitBreaker } from '../../src/nestjs/circuit-breaker.decorator.js';
import { CircuitBreakerRegistry } from '../../src/circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerOpenError } from '../../src/circuit-breaker/circuit-breaker.js';

function applyMethodDecorator(decorator: MethodDecorator, target: object, key: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
  const result = decorator(target, key, descriptor) as PropertyDescriptor | undefined;
  Object.defineProperty(target, key, result ?? descriptor);
}

describe('@WithCircuitBreaker', () => {
  it('throws a clear error at call time when the registry was not injected', async () => {
    class Service {
      async charge() { return 'ok'; }
    }
    applyMethodDecorator(
      WithCircuitBreaker({ name: 'x' }) as MethodDecorator,
      Service.prototype,
      'charge',
    );

    const svc = new Service();
    await expect(svc.charge()).rejects.toThrow(/CircuitBreakerRegistry not injected/);
  });

  it('wraps the method in the named circuit and records failures against it', async () => {
    class Service {
      circuitBreakerRegistry = new CircuitBreakerRegistry();
      calls = 0;

      async charge() {
        this.calls++;
        throw new Error('stripe down');
      }
    }
    applyMethodDecorator(
      WithCircuitBreaker({ name: 'stripe', failureThreshold: 1, openTimeoutMs: 10_000 }) as MethodDecorator,
      Service.prototype,
      'charge',
    );

    const svc = new Service();
    // @WithCircuitBreaker doesn't expose minimumCalls, so getOrCreate() falls
    // back to the registry default (5) -- 5 failures are needed to open it.
    for (let i = 0; i < 5; i++) {
      await expect(svc.charge()).rejects.toThrow('stripe down');
    }
    expect(svc.calls).toBe(5);

    const cb = svc.circuitBreakerRegistry.getOrCreate({ name: 'stripe' });
    expect(cb.getState()).toBe('open');

    // Circuit is now OPEN -- the underlying method must not run again.
    await expect(svc.charge()).rejects.toThrow(CircuitBreakerOpenError);
    expect(svc.calls).toBe(5);
  });

  it('invokes the configured fallback on OPEN or infra failure', async () => {
    class Service {
      circuitBreakerRegistry = new CircuitBreakerRegistry();
      async charge() { throw new Error('down'); }
    }
    applyMethodDecorator(
      WithCircuitBreaker({
        name: 'stripe-fb',
        failureThreshold: 1,
        fallback: () => 'degraded',
      }) as MethodDecorator,
      Service.prototype,
      'charge',
    );

    const svc = new Service();
    await expect(svc.charge()).resolves.toBe('degraded');
  });
});
