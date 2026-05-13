import { describe, it, expect, vi } from 'vitest';
import { CorrelationIdService }     from '../../src/correlation/correlation.service.js';

describe('CorrelationIdService', () => {
  const svc = new CorrelationIdService();

  it('returns a UUID when called outside any context', () => {
    const id = svc.get();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns undefined outside context via getOrUndefined', () => {
    expect(svc.getOrUndefined()).toBeUndefined();
  });

  it('propagates the ID to synchronous code inside run()', () => {
    svc.run('test-id-1', () => {
      expect(svc.get()).toBe('test-id-1');
    });
  });

  it('propagates the ID to async code inside run()', async () => {
    await new Promise<void>(resolve => {
      svc.run('async-id', async () => {
        await Promise.resolve();
        expect(svc.get()).toBe('async-id');
        resolve();
      });
    });
  });

  it('isolates contexts between concurrent run() calls', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>(resolve =>
        svc.run('ctx-A', async () => {
          await new Promise(r => setTimeout(r, 5));
          results.push(svc.get());
          resolve();
        }),
      ),
      new Promise<void>(resolve =>
        svc.run('ctx-B', async () => {
          await new Promise(r => setTimeout(r, 2));
          results.push(svc.get());
          resolve();
        }),
      ),
    ]);

    expect(results).toContain('ctx-A');
    expect(results).toContain('ctx-B');
    // Contexts must not bleed into each other
    expect(results.filter(v => v === 'ctx-A')).toHaveLength(1);
    expect(results.filter(v => v === 'ctx-B')).toHaveLength(1);
  });

  it('returns undefined for trace context when OTel is not installed', () => {
    // OTel is not available in test env
    expect(svc.getTraceContext()).toBeUndefined();
  });
});
