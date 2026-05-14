import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpClient } from '../../src/core/http-client.js';
import type { HttpClientConfig, HttpCtx, HttpClientError } from '../../src/core/types.js';
import { Ok, Err } from '@backendkit-labs/pipeline';
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';

// axios-mock-adapter operates at the adapter level, so we need to intercept the
// internal axios instance. We create the client first, then patch its internal adapter.
function makeClient(config: HttpClientConfig = {}): {
  client: HttpClient;
  mock:   MockAdapter;
} {
  const client = new HttpClient(config);
  // @ts-expect-error — accessing private field for test instrumentation
  const mock = new MockAdapter(client.axiosInstance);
  return { client, mock };
}

// ── GET / POST / PUT / PATCH / DELETE ─────────────────────────────────────────

describe('HTTP methods', () => {
  let client: HttpClient;
  let mock:   MockAdapter;

  beforeEach(() => {
    ({ client, mock } = makeClient());
  });

  afterEach(() => mock.reset());

  it('get() returns ok with data and status', async () => {
    mock.onGet('/users').reply(200, { id: 1 });
    const result = await client.get<{ id: number }>('/users');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data).toEqual({ id: 1 });
    expect(result.value.status).toBe(200);
  });

  it('post() sends body and returns response', async () => {
    mock.onPost('/users', { name: 'Alice' }).reply(201, { id: 2 });
    const result = await client.post<{ id: number }>('/users', { name: 'Alice' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data).toEqual({ id: 2 });
    expect(result.value.status).toBe(201);
  });

  it('put() returns ok', async () => {
    mock.onPut('/users/1').reply(200, { id: 1, name: 'Bob' });
    const result = await client.put('/users/1', { name: 'Bob' });
    expect(result.ok).toBe(true);
  });

  it('patch() returns ok', async () => {
    mock.onPatch('/users/1').reply(200, { id: 1 });
    const result = await client.patch('/users/1', { name: 'X' });
    expect(result.ok).toBe(true);
  });

  it('delete() returns ok', async () => {
    mock.onDelete('/users/1').reply(204, null);
    const result = await client.delete('/users/1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(204);
  });
});

// ── Error normalisation ────────────────────────────────────────────────────────

describe('error normalisation', () => {
  let client: HttpClient;
  let mock:   MockAdapter;

  beforeEach(() => {
    ({ client, mock } = makeClient());
  });

  afterEach(() => mock.reset());

  it('returns http error for 4xx response', async () => {
    mock.onGet('/not-found').reply(404, { message: 'Not Found' });
    const result = await client.get('/not-found');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(404);
    expect(result.error.data).toEqual({ message: 'Not Found' });
  });

  it('returns http error for 5xx response', async () => {
    mock.onGet('/error').reply(500, { error: 'Internal Server Error' });
    const result = await client.get('/error');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(500);
  });

  it('returns network error when no response', async () => {
    mock.onGet('/down').networkError();
    const result = await client.get('/down');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network');
  });

  it('returns timeout error on ECONNABORTED', async () => {
    mock.onGet('/slow').timeout();
    const result = await client.get('/slow', { timeout: 50 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('timeout');
  });
});

// ── Metrics ───────────────────────────────────────────────────────────────────

describe('metrics', () => {
  it('increments requests and success on ok response', async () => {
    const { client, mock } = makeClient();
    mock.onGet('/ok').reply(200, {});
    await client.get('/ok');
    const m = client.getMetrics();
    expect(m.requests).toBe(1);
    expect(m.success).toBe(1);
    expect(m.failed).toBe(0);
  });

  it('increments failed on error response', async () => {
    const { client, mock } = makeClient();
    mock.onGet('/fail').reply(500, {});
    await client.get('/fail');
    const m = client.getMetrics();
    expect(m.requests).toBe(1);
    expect(m.failed).toBe(1);
    expect(m.success).toBe(0);
  });

  it('increments cancelled when cancelRequest is called', () => {
    const { client } = makeClient();
    client.cancelRequest('key-does-not-exist');
    expect(client.getMetrics().cancelled).toBe(1);
  });

  it('increments cancelled by size when cancelAll is called', async () => {
    const { client, mock } = makeClient();
    // Start two requests that never respond so cancel tokens are alive
    mock.onGet('/a').reply(() => new Promise(() => undefined));
    mock.onGet('/b').reply(() => new Promise(() => undefined));
    const p1 = client.get('/a', { cancelKey: 'a' });
    const p2 = client.get('/b', { cancelKey: 'b' });
    client.cancelAll();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(client.getMetrics().cancelled).toBeGreaterThanOrEqual(2);
  });
});

// ── Retry ─────────────────────────────────────────────────────────────────────

describe('retry', () => {
  it('retries on 5xx and increments retried counter', async () => {
    const { client, mock } = makeClient({
      retry: { attempts: 2, delayMs: 1, jitter: false },
    });

    let calls = 0;
    mock.onGet('/flaky').reply(() => {
      calls++;
      return calls < 3 ? [500, {}] : [200, { ok: true }];
    });

    const result = await client.get('/flaky');
    expect(result.ok).toBe(true);
    expect(calls).toBe(3);
    expect(client.getMetrics().retried).toBe(2);
  });

  it('stops retrying when shouldRetry returns false', async () => {
    const { client, mock } = makeClient({
      retry: {
        attempts:    3,
        delayMs:     1,
        jitter:      false,
        shouldRetry: (e) => e.type === 'network',
      },
    });

    mock.onGet('/http-err').reply(503, {});
    await client.get('/http-err');
    expect(client.getMetrics().retried).toBe(0);
  });

  it('exhausts all attempts and returns fail on persistent error', async () => {
    const { client, mock } = makeClient({
      retry: { attempts: 2, delayMs: 1, jitter: false },
    });

    mock.onGet('/always-fail').reply(500, { msg: 'err' });
    const result = await client.get('/always-fail');
    expect(result.ok).toBe(false);
    expect(client.getMetrics().retried).toBe(2);
  });
});

// ── Circuit Breaker ───────────────────────────────────────────────────────────

describe('circuit breaker', () => {
  it('returns circuit-open error when breaker is open', async () => {
    const { client, mock } = makeClient({
      circuitBreaker: {
        failureThreshold:  50,
        minimumCalls:      1,
        slidingWindowSize: 2,
        openTimeoutMs:     60_000,
      },
    });

    mock.onGet('/cb').reply(500, {});

    // Two failures trip the circuit (100% > 50% threshold, window=2, min=1)
    await client.get('/cb');
    await client.get('/cb');

    // Now it should be open
    const result = await client.get('/cb');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('circuit-open');
    expect(client.getMetrics().circuitOpen).toBeGreaterThanOrEqual(1);
  });

  it('getCircuitBreakerState returns state object when configured', () => {
    const { client } = makeClient({
      circuitBreaker: { failureThreshold: 3, successThreshold: 1, timeout: 5000 },
    });
    expect(client.getCircuitBreakerState()).toBeDefined();
  });

  it('getCircuitBreakerState returns undefined when not configured', () => {
    const { client } = makeClient();
    expect(client.getCircuitBreakerState()).toBeUndefined();
  });
});

// ── Pipeline (pre-request middleware) ─────────────────────────────────────────

describe('pipeline middleware', () => {
  it('injects headers via pipeline step', async () => {
    let capturedHeaders: Record<string, string> = {};

    const headerStep: PipelineStep<HttpCtx, HttpClientError> = {
      stepName: 'add-auth',
      async handle(ctx): Promise<StepResult<HttpCtx, HttpClientError>> {
        return Ok({ ...ctx, headers: { ...ctx.headers, Authorization: 'Bearer token123' } });
      },
    };

    const { client, mock } = makeClient({ steps: [headerStep] });

    mock.onGet('/secure').reply((config) => {
      capturedHeaders = config.headers as Record<string, string>;
      return [200, {}];
    });

    await client.get('/secure');
    expect(capturedHeaders['Authorization']).toBe('Bearer token123');
  });

  it('returns fail when pipeline step fails', async () => {
    const blockingStep: PipelineStep<HttpCtx, HttpClientError> = {
      stepName: 'blocker',
      async handle(): Promise<StepResult<HttpCtx, HttpClientError>> {
        return Err({ type: 'network', message: 'Blocked by middleware' });
      },
    };

    const { client } = makeClient({ steps: [blockingStep] });
    const result = await client.get('/any');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe('Blocked by middleware');
  });
});

// ── Cancellation ──────────────────────────────────────────────────────────────

describe('cancellation', () => {
  it('cancelled request returns cancelled error type', async () => {
    const { client, mock } = makeClient();

    mock.onGet('/slow').reply(() => new Promise(() => undefined));

    const promise = client.get('/slow', { cancelKey: 'my-request' });
    client.cancelRequest('my-request');

    const result = await promise;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('cancelled');
  });
});
