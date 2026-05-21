// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/saga.interceptor.test.ts
//
// Integration tests for SagaCorrelationIdInterceptor.
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import { SagaCorrelationIdInterceptor, CORRELATION_ID_HEADER } from '../../src/nestjs/saga.interceptor';

describe('SagaCorrelationIdInterceptor', () => {
  let interceptor: SagaCorrelationIdInterceptor;

  beforeEach(() => {
    interceptor = new SagaCorrelationIdInterceptor();
  });

  it('should extract correlationId from x-correlation-id header', () => {
    const request = { headers: { 'x-correlation-id': 'corr-123' } };
    const context = createMockExecutionContext(request);
    const next = createMockCallHandler();

    interceptor.intercept(context, next);

    expect((request as any).correlationId).toBe('corr-123');
  });

  it('should set correlationId in lowercase header lookup', () => {
    const request = { headers: { 'x-correlation-id': 'corr-abc' } };
    const context = createMockExecutionContext(request);
    const next = createMockCallHandler();

    interceptor.intercept(context, next);

    expect((request as any).correlationId).toBe('corr-abc');
  });

  it('should not set correlationId when header is missing', () => {
    const request = { headers: {} };
    const context = createMockExecutionContext(request);
    const next = createMockCallHandler();

    interceptor.intercept(context, next);

    expect((request as any).correlationId).toBeUndefined();
  });

  it('should call next.handle()', () => {
    const request = { headers: {} };
    const context = createMockExecutionContext(request);
    const next = createMockCallHandler();

    interceptor.intercept(context, next);

    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('should return the observable from next.handle()', () => {
    const request = { headers: {} };
    const context = createMockExecutionContext(request);
    const next = createMockCallHandler();
    const observable = { pipe: vi.fn() };
    (next.handle as ReturnType<typeof vi.fn>).mockReturnValue(observable);

    const result = interceptor.intercept(context, next);

    expect(result).toBe(observable);
  });

  it('should not match header with different casing (only lowercase checked)', () => {
    const request = { headers: { 'X-Correlation-Id': 'corr-xyz' } };
    const context = createMockExecutionContext(request);
    const next = createMockCallHandler();

    interceptor.intercept(context, next);

    expect((request as any).correlationId).toBeUndefined();
  });

  describe('CORRELATION_ID_HEADER constant', () => {
    it('should be x-correlation-id', () => {
      expect(CORRELATION_ID_HEADER).toBe('x-correlation-id');
    });
  });
});

// =====================================================================
// Helpers
// =====================================================================

import { of } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

function createMockExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => class {},
    getHandler: () => (() => {}),
    getArgs: () => [],
    getArgByIndex: (_i: number) => undefined,
    switchToRpc: () => ({ getContext: () => ({}) }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => ({}) }),
    getType: () => 'http' as any,
  } as unknown as ExecutionContext;
}

function createMockCallHandler(): CallHandler {
  return {
    handle: vi.fn(() => of({})),
  };
}
