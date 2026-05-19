import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisIdempotencyStore }                from '../../src/store/redis.store.js';
import type { RedisClient }                     from '../../src/store/redis.store.js';
import type { IdempotencyRecord }               from '../../src/idempotency.types.js';

const makeRecord = (overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord => ({
  key:           'POST:/orders:key-abc',
  status:        'pending',
  statusCode:    0,
  body:          null,
  correlationId: 'corr-1',
  createdAt:     1000,
  completedAt:   undefined,
  ...overrides,
});

const makeRedis = (): RedisClient => ({
  set:   vi.fn(),
  get:   vi.fn(),
  setex: vi.fn(),
  del:   vi.fn(),
});

describe('RedisIdempotencyStore — setIfAbsent', () => {
  let redis: RedisClient;
  let store: RedisIdempotencyStore;
  beforeEach(() => {
    redis = makeRedis();
    store = new RedisIdempotencyStore(redis);
  });

  it('returns null when SET NX succeeds (key was absent)', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');
    const result = await store.setIfAbsent(makeRecord(), 60);
    expect(result).toBeNull();
  });

  it('calls SET with nx:true and correct ex', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');
    const rec = makeRecord();
    await store.setIfAbsent(rec, 120);
    expect(redis.set).toHaveBeenCalledWith(rec.key, expect.any(String), { nx: true, ex: 120 });
  });

  it('returns existing record when SET NX fails (key present)', async () => {
    const existing = makeRecord({ correlationId: 'original' });
    vi.mocked(redis.set).mockResolvedValue(null);
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(existing));

    const result = await store.setIfAbsent(makeRecord({ correlationId: 'new' }), 60);
    expect(result).not.toBeNull();
    expect(result!.correlationId).toBe('original');
  });

  it('returns null when SET NX fails and GET returns null (race condition)', async () => {
    vi.mocked(redis.set).mockResolvedValue(null);
    vi.mocked(redis.get).mockResolvedValue(null);
    const result = await store.setIfAbsent(makeRecord(), 60);
    expect(result).toBeNull();
  });
});

describe('RedisIdempotencyStore — get', () => {
  let redis: RedisClient;
  let store: RedisIdempotencyStore;
  beforeEach(() => {
    redis = makeRedis();
    store = new RedisIdempotencyStore(redis);
  });

  it('returns null when Redis returns null', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    expect(await store.get('ghost')).toBeNull();
  });

  it('deserializes the JSON record from Redis', async () => {
    const rec = makeRecord({ status: 'completed', statusCode: 201 });
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(rec));
    const result = await store.get(rec.key);
    expect(result!.status).toBe('completed');
    expect(result!.statusCode).toBe(201);
  });
});

describe('RedisIdempotencyStore — complete', () => {
  let redis: RedisClient;
  let store: RedisIdempotencyStore;
  beforeEach(() => {
    redis = makeRedis();
    store = new RedisIdempotencyStore(redis);
  });

  it('reads, merges completed fields, and writes back with SETEX', async () => {
    const rec = makeRecord();
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(rec));
    vi.mocked(redis.setex).mockResolvedValue('OK');

    await store.complete(rec.key, 201, { id: 'order-1' }, 3600);

    expect(redis.setex).toHaveBeenCalledOnce();
    const [key, ttl, raw] = vi.mocked(redis.setex).mock.calls[0] as [string, number, string];
    expect(key).toBe(rec.key);
    expect(ttl).toBe(3600);
    const written = JSON.parse(raw) as IdempotencyRecord;
    expect(written.status).toBe('completed');
    expect(written.statusCode).toBe(201);
    expect(written.body).toEqual({ id: 'order-1' });
  });

  it('is a no-op when GET returns null', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    await store.complete('ghost', 200, null, 60);
    expect(redis.setex).not.toHaveBeenCalled();
  });
});

describe('RedisIdempotencyStore — delete', () => {
  let redis: RedisClient;
  let store: RedisIdempotencyStore;
  beforeEach(() => {
    redis = makeRedis();
    store = new RedisIdempotencyStore(redis);
  });

  it('calls DEL with the correct key', async () => {
    vi.mocked(redis.del).mockResolvedValue(1);
    await store.delete('some-key');
    expect(redis.del).toHaveBeenCalledWith('some-key');
  });
});
