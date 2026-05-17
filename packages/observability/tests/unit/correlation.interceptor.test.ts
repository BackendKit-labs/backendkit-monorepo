import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Observable, of }                       from 'rxjs';
import { CorrelationInterceptor }               from '../../src/interceptors/correlation.interceptor.js';
import { CorrelationIdService }                 from '../../src/correlation/correlation.service.js';

function makeContext(headers: Record<string, string | undefined>): any {
  const resHeaders: Record<string, string> = {};
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => { resHeaders[name] = value; },
      }),
    }),
  };
}

describe('CorrelationInterceptor', () => {
  let svc: CorrelationIdService;
  let interceptor: CorrelationInterceptor;

  beforeEach(() => {
    svc = new CorrelationIdService();
    interceptor = new CorrelationInterceptor(svc);
  });

  // ── C3: Correlation ID sanitization ──────────────────────────────

  it('accepts a valid correlation ID from header', () => {
    const ctx = makeContext({ 'x-correlation-id': 'abc-123_DE:F' });
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).toBe('abc-123_DE:F');
  });

  it('rejects header with invalid characters and generates UUID', () => {
    const ctx = makeContext({ 'x-correlation-id': 'abc\n123' });
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).not.toBe('abc\n123');
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('rejects header longer than 64 chars and generates UUID', () => {
    const longId = 'a'.repeat(65);
    const ctx = makeContext({ 'x-correlation-id': longId });
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).not.toBe(longId);
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('rejects header with whitespace and generates UUID', () => {
    const ctx = makeContext({ 'x-correlation-id': 'abc def' });
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).not.toBe('abc def');
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('rejects header with control characters and generates UUID', () => {
    const ctx = makeContext({ 'x-correlation-id': 'abc\x00def' });
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('rejects non-string header (e.g. array) and generates UUID', () => {
    const ctx = makeContext({ 'x-correlation-id': ['a', 'b'] } as any);
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('rejects header with special chars like < > and generates UUID', () => {
    const ctx = makeContext({ 'x-correlation-id': '<script>' });
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('generates UUID when no header is present', () => {
    const ctx = makeContext({});
    let capturedId = '';
    const next: any = { handle: () => new Observable(sub => { capturedId = svc.get(); sub.next(); sub.complete(); }) };

    interceptor.intercept(ctx, next).subscribe();
    expect(capturedId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('sets the response header with the correlation ID', () => {
    const resHeaders: Record<string, string> = {};
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-correlation-id': 'my-id' } }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => { resHeaders[name] = value; },
        }),
      }),
    };
    const next: any = { handle: () => of(null) };

    interceptor.intercept(ctx, next).subscribe();
    expect(resHeaders['x-correlation-id']).toBe('my-id');
  });

  // ── L1: No empty tap ─────────────────────────────────────────────

  it('completes the observable without errors (no empty tap)', () => {
    const ctx = makeContext({});
    const next: any = { handle: () => of('data') };
    const result: unknown[] = [];

    interceptor.intercept(ctx, next).subscribe({
      next: (v) => result.push(v),
      error: () => { throw new Error('should not error'); },
      complete: () => { /* no-op — verifies no empty tap causes issues */ },
    });

    expect(result).toEqual(['data']);
  });
});
