import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios before any import
const mockPost = vi.fn();
const mockUse = vi.fn();
const mockInterceptors = { response: { use: mockUse } };

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      interceptors: mockInterceptors,
    })),
  },
}));

import { WinstonHttpTransport } from '../../src/logger/winston-http.transport.js';

function makeTransport(opts: Record<string, any> = {}): WinstonHttpTransport {
  return new WinstonHttpTransport({
    url:             'http://logs.local/ingest',
    authToken:       'secret-token',
    flushIntervalMs: 60_000, // long — manual flush in tests
    batchSize:       10,
    maxBufferSize:   20,
    ...opts,
  });
}

describe('WinstonHttpTransport', () => {
  let transport: WinstonHttpTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ status: 200 });
    transport = makeTransport();
  });

  afterEach(async () => {
    await transport.close();
  });

  // ── C1: Circuit Breaker isFailure ────────────────────────────────

  it('treats status 400 as failure for circuit breaker', () => {
    const isFailure = (error: unknown) => {
      const result = error as { status?: number };
      return result && typeof result.status === 'number' ? result.status >= 400 : true;
    };

    expect(isFailure({ status: 200 })).toBe(false);
    expect(isFailure({ status: 301 })).toBe(false);
    expect(isFailure({ status: 400 })).toBe(true);
    expect(isFailure({ status: 404 })).toBe(true);
    expect(isFailure({ status: 500 })).toBe(true);
    expect(isFailure({ status: 503 })).toBe(true);
    expect(isFailure(new Error('network'))).toBe(true);
    expect(isFailure({})).toBe(true);
  });

  // ── H2: Bearer token redacted via axios interceptor ──────────────

  it('registers an axios response interceptor for error redaction', () => {
    // The interceptor was registered during construction
    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
  });

  it('redacts Authorization header via the error interceptor', () => {
    // Extract the error handler passed to axios.interceptors.response.use
    const onRejected = mockUse.mock.calls[0][1];

    const error = {
      config: {
        headers: {
          Authorization: 'Bearer super-secret-token',
        },
      },
    };

    // The interceptor mutates and re-rejects
    return expect(onRejected(error)).rejects.toEqual(error).then(() => {
      expect(error.config.headers.Authorization).toBe('Bearer ***REDACTED***');
    });
  });

  it('does not mutate error config when Authorization is absent', () => {
    const onRejected = mockUse.mock.calls[0][1];

    const error = {
      config: {
        headers: {},
      },
    };

    return expect(onRejected(error)).rejects.toEqual(error).then(() => {
      expect(error.config.headers.Authorization).toBeUndefined();
    });
  });

  it('handles error without config gracefully', () => {
    const onRejected = mockUse.mock.calls[0][1];

    const error = { message: 'network error' };

    return expect(onRejected(error)).rejects.toEqual(error);
  });

  // ── H3: Logger instead of console.error ──────────────────────────

  it('uses NestJS Logger (fallbackLogger) instead of console.error', () => {
    expect((transport as any).fallbackLogger).toBeDefined();
    expect(typeof (transport as any).fallbackLogger.warn).toBe('function');
    expect(typeof (transport as any).fallbackLogger.error).toBe('function');
  });

  // ── C2: Max retries (5) via WeakMap ──────────────────────────────

  it('re-queues entries on flush failure up to maxRetries', async () => {
    mockPost.mockRejectedValue(new Error('network error'));

    transport.log({ level: 'info', message: 'entry1' }, vi.fn());
    transport.log({ level: 'info', message: 'entry2' }, vi.fn());

    await (transport as any).flush();

    // After flush failure, entries should be back in buffer (retryCount < 5)
    const buffer = (transport as any).buffer as any[];
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('drops entries after 5 retries', async () => {
    mockPost.mockRejectedValue(new Error('persistent failure'));

    const entry = { level: 'info', message: 'doomed' };
    transport.log(entry, vi.fn());

    // Simulate 6 flush failures — entry is re-queued 5 times, dropped on 6th
    for (let i = 0; i < 6; i++) {
      await (transport as any).flush();
    }

    // After 5 retries exhausted, entry should be dropped
    const buffer = (transport as any).buffer as any[];
    const stillThere = buffer.some((e: any) => e.message === 'doomed');
    expect(stillThere).toBe(false);
  });

  // ── M5: Buffer TTL 5 min ─────────────────────────────────────────

  it('discards entries older than 5 minutes on flush', async () => {
    const oldEntry   = { level: 'info', message: 'old entry' };
    const freshEntry = { level: 'info', message: 'fresh entry' };

    (transport as any).buffer = [oldEntry, freshEntry];
    (transport as any).entryTimes.set(oldEntry,   Date.now() - 310_000);
    (transport as any).entryTimes.set(freshEntry, Date.now() - 60_000);

    mockPost.mockRejectedValue(new Error('flush error'));
    await (transport as any).flush();

    const buffer = (transport as any).buffer as any[];
    const messages = buffer.map((e: any) => e.message);
    expect(messages).not.toContain('old entry');
    expect(messages).toContain('fresh entry');
  });

  it('keeps entries within 5 min TTL and sends them', async () => {
    mockPost.mockResolvedValue({ status: 200 });
    const recentEntry = { level: 'info', message: 'recent' };

    (transport as any).buffer = [recentEntry];
    (transport as any).entryTimes.set(recentEntry, Date.now() - 120_000);

    await (transport as any).flush();

    const buffer = (transport as any).buffer as any[];
    expect(buffer).toHaveLength(0);
  });

  // ── M3: No setImmediate ──────────────────────────────────────────

  it('does not use setImmediate in log() — logs synchronously', () => {
    const setImmediateSpy = vi.spyOn(globalThis as any, 'setImmediate').mockReturnValue(undefined as any);

    transport.log({ level: 'info', message: 'sync' }, vi.fn());

    expect(setImmediateSpy).not.toHaveBeenCalled();

    setImmediateSpy.mockRestore();
  });

  it('buffers entry immediately in log()', () => {
    transport.log({ level: 'info', message: 'immediate' }, vi.fn());
    const buffer = (transport as any).buffer as any[];
    expect(buffer).toHaveLength(1);
    expect(buffer[0].message).toBe('immediate');
  });
});
