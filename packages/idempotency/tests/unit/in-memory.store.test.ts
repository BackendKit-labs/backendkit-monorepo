import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryIdempotencyStore }              from '../../src/store/in-memory.store.js';
import type { IdempotencyRecord }                from '../../src/idempotency.types.js';

const makeRecord = (overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord => ({
  key:           'POST:/orders:key-abc',
  status:        'pending',
  statusCode:    0,
  body:          null,
  correlationId: 'corr-1',
  createdAt:     Date.now(),
  completedAt:   undefined,
  ...overrides,
});

describe('InMemoryIdempotencyStore — setIfAbsent', () => {
  let store: InMemoryIdempotencyStore;
  beforeEach(() => { store = new InMemoryIdempotencyStore(); });

  it('returns null on first insert (key was absent)', async () => {
    const rec = makeRecord();
    const result = await store.setIfAbsent(rec, 60);
    expect(result).toBeNull();
  });

  it('returns the existing record when key is already present', async () => {
    const rec = makeRecord();
    await store.setIfAbsent(rec, 60);
    const second = await store.setIfAbsent(makeRecord({ correlationId: 'other' }), 60);
    expect(second).not.toBeNull();
    expect(second!.correlationId).toBe('corr-1'); // original, not the new one
  });

  it('two different keys insert independently', async () => {
    const a = makeRecord({ key: 'key-A' });
    const b = makeRecord({ key: 'key-B' });
    expect(await store.setIfAbsent(a, 60)).toBeNull();
    expect(await store.setIfAbsent(b, 60)).toBeNull();
  });
});

describe('InMemoryIdempotencyStore — get', () => {
  let store: InMemoryIdempotencyStore;
  beforeEach(() => { store = new InMemoryIdempotencyStore(); });

  it('returns null for unknown key', async () => {
    expect(await store.get('ghost')).toBeNull();
  });

  it('returns stored record for known key', async () => {
    const rec = makeRecord();
    await store.setIfAbsent(rec, 60);
    const found = await store.get(rec.key);
    expect(found).not.toBeNull();
    expect(found!.key).toBe(rec.key);
  });
});

describe('InMemoryIdempotencyStore — complete', () => {
  let store: InMemoryIdempotencyStore;
  beforeEach(() => { store = new InMemoryIdempotencyStore(); });

  it('transitions status from pending to completed', async () => {
    const rec = makeRecord();
    await store.setIfAbsent(rec, 60);
    await store.complete(rec.key, 201, { id: 'order-1' }, 3600);
    const found = await store.get(rec.key);
    expect(found!.status).toBe('completed');
    expect(found!.statusCode).toBe(201);
    expect(found!.body).toEqual({ id: 'order-1' });
    expect(found!.completedAt).toBeTypeOf('number');
  });

  it('is a no-op for unknown keys', async () => {
    await expect(store.complete('ghost', 200, null, 60)).resolves.toBeUndefined();
  });
});

describe('InMemoryIdempotencyStore — delete', () => {
  let store: InMemoryIdempotencyStore;
  beforeEach(() => { store = new InMemoryIdempotencyStore(); });

  it('removes an existing record', async () => {
    const rec = makeRecord();
    await store.setIfAbsent(rec, 60);
    await store.delete(rec.key);
    expect(await store.get(rec.key)).toBeNull();
  });

  it('is a no-op for unknown keys', async () => {
    await expect(store.delete('ghost')).resolves.toBeUndefined();
  });
});

describe('InMemoryIdempotencyStore — TTL eviction', () => {
  it('evicts expired records on next access', async () => {
    vi.useFakeTimers();
    const store = new InMemoryIdempotencyStore();
    const rec   = makeRecord();
    await store.setIfAbsent(rec, 1); // 1 second TTL

    vi.advanceTimersByTime(1500);     // fast-forward past TTL

    // A subsequent call triggers eviction
    expect(await store.get(rec.key)).toBeNull();
    vi.useRealTimers();
  });

  it('allows reuse of an expired key as a fresh insert', async () => {
    vi.useFakeTimers();
    const store = new InMemoryIdempotencyStore();
    const rec   = makeRecord();
    await store.setIfAbsent(rec, 1);

    vi.advanceTimersByTime(1500);

    // After expiry, the key behaves as absent
    const result = await store.setIfAbsent(makeRecord({ correlationId: 'new-corr' }), 60);
    expect(result).toBeNull(); // inserted fresh
    vi.useRealTimers();
  });
});
