// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/http-client-adapter.test.ts
//
// Integration tests for SagaHttpClient.
// Requires a global mock for fetch().
// ---------------------------------------------------------------------------

import { isOk, isFail } from '@backendkit-labs/result';
import { SagaHttpClient } from '../../src/integration/http-client-adapter';

import type { StepError } from '../../src/types/error.types';

// =====================================================================
// Helpers
// =====================================================================

function createMockResponse(overrides: Partial<Response>): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({}),
    text: async () => '',
    ...overrides,
  } as Response;
}

// =====================================================================
// Tests
// =====================================================================

describe('SagaHttpClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveUrl', () => {
    it('should return absolute URLs unchanged', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ ok: true, status: 200, json: async () => ({ id: 1 }) }),
      );

      const client = new SagaHttpClient({ baseURL: 'https://api.example.com' });
      await client.get('https://other.com/api/resource');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://other.com/api/resource',
        expect.any(Object),
      );
    });

    it('should combine baseURL with relative path', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ ok: true, status: 200, json: async () => ({}) }),
      );

      const client = new SagaHttpClient({ baseURL: 'https://api.example.com' });
      await client.get('/resource');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/resource',
        expect.any(Object),
      );
    });

    it('should handle trailing slashes in baseURL correctly', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ ok: true, status: 200, json: async () => ({}) }),
      );

      const client = new SagaHttpClient({ baseURL: 'https://api.example.com/api/' });
      await client.get('/v1/users');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/users',
        expect.any(Object),
      );
    });
  });

  describe('request()', () => {
    it('should return ok when response status is 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ id: 42, name: 'Alice' }),
        }),
      );

      const client = new SagaHttpClient();
      const result = await client.get<{ id: number; name: string }>('/users/42');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.status).toBe(200);
        expect(result.value.data).toEqual({ id: 42, name: 'Alice' });
      }
    });

    it('should return INFRASTRUCTURE_ERROR on 500', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      const client = new SagaHttpClient();
      const result = await client.get('/fail');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        const error = result.error as StepError;
        expect(error.type).toBe('INFRASTRUCTURE_ERROR');
        expect('code' in error && error.code).toBe('HTTP_500');
      }
    });

    it('should return BUSINESS_ERROR on 400', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        }),
      );

      const client = new SagaHttpClient();
      const result = await client.get('/bad-request');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        const error = result.error as StepError;
        expect(error.type).toBe('BUSINESS_ERROR');
        expect('code' in error && error.code).toBe('HTTP_400');
      }
    });

    it('should return INFRASTRUCTURE_ERROR on 503', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        }),
      );

      const client = new SagaHttpClient();
      const result = await client.get('/unavailable');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        const error = result.error as StepError;
        expect(error.type).toBe('INFRASTRUCTURE_ERROR');
      }
    });

    it('should return INFRASTRUCTURE_ERROR on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const client = new SagaHttpClient();
      const result = await client.get('/fail');

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        const error = result.error as StepError;
        expect(error.type).toBe('INFRASTRUCTURE_ERROR');
        expect('code' in error && error.code).toBe('HTTP_REQUEST_FAILED');
      }
    });

    it('should pass custom headers', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ ok: true, status: 200, json: async () => ({}) }),
      );

      const client = new SagaHttpClient({ headers: { Authorization: 'Bearer token' } });
      await client.get('/resource', { headers: { 'X-Custom': 'value' } });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
            'X-Custom': 'value',
          }),
        }),
      );
    });

    it('should merge base config headers with request headers', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ ok: true, status: 200, json: async () => ({}) }),
      );

      const client = new SagaHttpClient({ headers: { 'X-API-Key': 'abc123' } });
      await client.get('/resource', { headers: { 'X-Custom': 'value' } });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'abc123',
            'X-Custom': 'value',
          }),
        }),
      );
    });
  });

  describe('HTTP method shortcuts', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ ok: true, status: 200, json: async () => ({}) }),
      );
    });

    it('should call request with GET method', async () => {
      const client = new SagaHttpClient();
      const requestSpy = vi.spyOn(client, 'request');
      await client.get('/resource');

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', url: '/resource' }),
      );
    });

    it('should call request with POST method and data', async () => {
      const client = new SagaHttpClient();
      const requestSpy = vi.spyOn(client, 'request');
      const data = { name: 'test' };
      await client.post('/resource', data);

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', url: '/resource', data }),
      );
    });

    it('should call request with PUT method and data', async () => {
      const client = new SagaHttpClient();
      const requestSpy = vi.spyOn(client, 'request');
      const data = { name: 'updated' };
      await client.put('/resource/1', data);

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PUT', url: '/resource/1', data }),
      );
    });

    it('should call request with PATCH method and data', async () => {
      const client = new SagaHttpClient();
      const requestSpy = vi.spyOn(client, 'request');
      const data = { name: 'patched' };
      await client.patch('/resource/1', data);

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PATCH', url: '/resource/1', data }),
      );
    });

    it('should call request with DELETE method', async () => {
      const client = new SagaHttpClient();
      const requestSpy = vi.spyOn(client, 'request');
      await client.delete('/resource/1');

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', url: '/resource/1' }),
      );
    });
  });

  describe('Response body parsing', () => {
    it('should parse JSON response when content-type is application/json', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ key: 'value' }),
        }),
      );

      const client = new SagaHttpClient();
      const result = await client.get('/json');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.data).toEqual({ key: 'value' });
      }
    });

    it('should parse text response when content-type is not JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createMockResponse({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => 'plain text',
        }),
      );

      const client = new SagaHttpClient();
      const result = await client.get('/text');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.data).toBe('plain text');
      }
    });
  });

  describe('AbortController timeout', () => {
    it('should abort on timeout', async () => {
      // Create a fetch mock that responds to abort signals
      // When the signal is aborted, reject with a DOMException-like error
      const fetchMock = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = opts.signal as AbortSignal;
          const onAbort = () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
      });
      globalThis.fetch = fetchMock;

      const client = new SagaHttpClient({ timeoutMs: 50 });
      const startTime = Date.now();
      const result = await client.get('/slow');
      const elapsed = Date.now() - startTime;

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        const error = result.error as StepError;
        expect(error.type).toBe('INFRASTRUCTURE_ERROR');
        expect('code' in error && error.code).toBe('HTTP_REQUEST_FAILED');
      }

      expect(elapsed).toBeLessThan(2000);
    }, 5000);
  });
});
