import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisStorageAdapter, RedisClient } from '../../src/adapters/redis.js';
import { TunableConfig } from '../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeConfig = (overrides: Partial<TunableConfig> = {}): TunableConfig => ({
  circuitBreaker: { failureThreshold: 50, openTimeoutMs: 30_000 },
  bulkhead:       { maxConcurrentCalls: 10 },
  httpClient:     { timeoutMs: 10_000, maxRetries: 3 },
  ...overrides,
});

function makeClient(overrides: Partial<Record<keyof RedisClient, unknown>> = {}): RedisClient {
  return {
    get:   vi.fn().mockResolvedValue(null),
    set:   vi.fn().mockResolvedValue('OK'),
    setEx: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadConfigAsync
// ---------------------------------------------------------------------------

describe('RedisStorageAdapter.loadConfigAsync()', () => {
  it('returns null when Redis has no config', async () => {
    const adapter = new RedisStorageAdapter(makeClient());
    const result  = await adapter.loadConfigAsync();
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBeNull();
  });

  it('parses and returns config from Redis', async () => {
    const config  = makeConfig({ circuitBreaker: { failureThreshold: 70, openTimeoutMs: 60_000 } });
    const client  = makeClient({ get: vi.fn().mockResolvedValue(JSON.stringify(config)) });
    const adapter = new RedisStorageAdapter(client);

    const result = await adapter.loadConfigAsync();
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual(config);
  });

  it('seeds in-memory state so loadConfig() returns the Redis value', async () => {
    const config  = makeConfig({ bulkhead: { maxConcurrentCalls: 25 } });
    const client  = makeClient({ get: vi.fn().mockResolvedValue(JSON.stringify(config)) });
    const adapter = new RedisStorageAdapter(client);

    await adapter.loadConfigAsync();

    const inMem = adapter.loadConfig();
    expect(inMem.ok).toBe(true);
    expect(inMem.ok && inMem.value?.bulkhead.maxConcurrentCalls).toBe(25);
  });

  it('uses the configured keyPrefix', async () => {
    const client  = makeClient();
    const adapter = new RedisStorageAdapter(client, { keyPrefix: 'myapp:' });
    await adapter.loadConfigAsync();
    expect(client.get).toHaveBeenCalledWith('myapp:config');
  });

  it('returns storageError when Redis throws', async () => {
    const client  = makeClient({ get: vi.fn().mockRejectedValue(new Error('connection refused')) });
    const adapter = new RedisStorageAdapter(client);
    const result  = await adapter.loadConfigAsync();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.tag).toBe('STORAGE_ERROR');
  });
});

// ---------------------------------------------------------------------------
// saveConfig
// ---------------------------------------------------------------------------

describe('RedisStorageAdapter.saveConfig()', () => {
  it('persists config to in-memory synchronously', () => {
    const adapter = new RedisStorageAdapter(makeClient());
    const config  = makeConfig({ httpClient: { timeoutMs: 5_000, maxRetries: 1 } });

    const result = adapter.saveConfig(config);
    expect(result.ok).toBe(true);

    const loaded = adapter.loadConfig();
    expect(loaded.ok && loaded.value?.httpClient.timeoutMs).toBe(5_000);
  });

  it('calls setEx with the config key, ttl, and serialized value', async () => {
    const client  = makeClient();
    const adapter = new RedisStorageAdapter(client, { configTtlSeconds: 3600 });
    const config  = makeConfig();

    adapter.saveConfig(config);
    // Fire-and-forget — flush the microtask queue before asserting
    await Promise.resolve();

    expect(client.setEx).toHaveBeenCalledWith(
      'auto-learning:config',
      3600,
      JSON.stringify(config),
    );
  });

  it('falls back to set() when setEx is not present', async () => {
    const client: RedisClient = {
      get:   vi.fn().mockResolvedValue(null),
      set:   vi.fn().mockResolvedValue('OK'),
      // no setEx
    };
    const adapter = new RedisStorageAdapter(client);
    adapter.saveConfig(makeConfig());
    await Promise.resolve();
    expect(client.set).toHaveBeenCalled();
  });

  it('does not throw when Redis write fails (fire-and-forget)', async () => {
    const client  = makeClient({ setEx: vi.fn().mockRejectedValue(new Error('timeout')) });
    const adapter = new RedisStorageAdapter(client);
    expect(() => adapter.saveConfig(makeConfig())).not.toThrow();
    // Allow the rejection to be handled
    await new Promise(r => setTimeout(r, 0));
  });

  it('in-memory config remains valid after a Redis write failure', async () => {
    const client  = makeClient({ setEx: vi.fn().mockRejectedValue(new Error('timeout')) });
    const adapter = new RedisStorageAdapter(client);
    const config  = makeConfig({ bulkhead: { maxConcurrentCalls: 99 } });

    adapter.saveConfig(config);
    await new Promise(r => setTimeout(r, 0));

    const loaded = adapter.loadConfig();
    expect(loaded.ok && loaded.value?.bulkhead.maxConcurrentCalls).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// InMemoryStorage methods pass through unchanged
// ---------------------------------------------------------------------------

describe('RedisStorageAdapter — InMemoryStorage pass-through', () => {
  it('savePattern / getPatterns work as in InMemoryStorage', () => {
    const adapter = new RedisStorageAdapter(makeClient());
    const now     = new Date();

    adapter.savePattern({
      method: 'POST', path: '/orders', statusCode: 201,
      durationMs: 120, timestamp: now,
    });

    const result = adapter.getPatterns(
      new Date(now.getTime() - 1000),
      new Date(now.getTime() + 1000),
    );
    expect(result.ok && result.value).toHaveLength(1);
  });

  it('prune removes in-memory patterns', () => {
    const adapter = new RedisStorageAdapter(makeClient());
    const past    = new Date(Date.now() - 10_000);

    adapter.savePattern({ method: 'GET', path: '/x', statusCode: 200, durationMs: 10, timestamp: past });

    const pruned = adapter.prune(new Date());
    expect(pruned.ok && pruned.value).toBeGreaterThan(0);
  });
});
