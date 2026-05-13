import { describe, it, expect, vi } from 'vitest';
import {
  ok, fail, fromThrowable, fromPromise, fromNullable,
  isOk, isFail, isRich,
  map, mapError, flatMap, flatMapAsync, mapAsync,
  match, fold,
  tap, tapError,
  unwrap, unwrapError, unwrapOr, unwrapOrElse, expect as resultExpect,
  toPromise, toNullable, toUndefined,
  run, track, enrich, simplify,
} from '../../src/index.js';

// ── Constructors ────────────────────────────────────────────────────────────

describe('ok / fail', () => {
  it('ok creates a success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect((r as { value: number }).value).toBe(42);
  });

  it('fail creates a failure result', () => {
    const r = fail(new Error('oops'));
    expect(r.ok).toBe(false);
    expect((r as { error: Error }).error.message).toBe('oops');
  });

  it('error type can be a string', () => {
    const r = fail<number, string>('not-found');
    expect(r.ok).toBe(false);
  });
});

describe('fromThrowable', () => {
  it('returns ok when function succeeds', () => {
    const r = fromThrowable(() => JSON.parse('{"x":1}'));
    expect(isOk(r)).toBe(true);
  });

  it('returns fail when function throws', () => {
    const r = fromThrowable(() => JSON.parse('bad'));
    expect(isFail(r)).toBe(true);
  });

  it('applies errorTransform when provided', () => {
    const r = fromThrowable<number, string>(
      () => { throw new Error('raw'); },
      (e) => `wrapped: ${(e as Error).message}`,
    );
    expect((r as { error: string }).error).toBe('wrapped: raw');
  });
});

describe('fromPromise', () => {
  it('returns ok on resolved promise', async () => {
    const r = await fromPromise(Promise.resolve(99));
    expect(isOk(r)).toBe(true);
    expect((r as { value: number }).value).toBe(99);
  });

  it('returns fail on rejected promise', async () => {
    const r = await fromPromise(Promise.reject(new Error('net')));
    expect(isFail(r)).toBe(true);
  });
});

describe('fromNullable', () => {
  it('returns ok for a defined value', () => {
    expect(isOk(fromNullable('hello', 'missing'))).toBe(true);
  });

  it('returns fail for null', () => {
    expect(isFail(fromNullable(null, 'missing'))).toBe(true);
  });

  it('returns fail for undefined', () => {
    expect(isFail(fromNullable(undefined, 'missing'))).toBe(true);
  });
});

// ── Guards ──────────────────────────────────────────────────────────────────

describe('isOk / isFail / isRich', () => {
  it('isOk narrows correctly', () => {
    const r = ok(1);
    if (isOk(r)) expect(r.value).toBe(1);
    else expect.fail('should be ok');
  });

  it('isFail narrows correctly', () => {
    const r = fail<number, string>('err');
    if (isFail(r)) expect(r.error).toBe('err');
    else expect.fail('should fail');
  });

  it('isRich returns false for plain results', () => {
    expect(isRich(ok(1))).toBe(false);
  });

  it('isRich returns true for track() output', async () => {
    const r = await track(() => 42);
    expect(isRich(r)).toBe(true);
  });
});

// ── Transformations ─────────────────────────────────────────────────────────

describe('map', () => {
  it('transforms success value', () => {
    const r = map(ok(2), x => x * 3);
    expect((r as { value: number }).value).toBe(6);
  });

  it('passes failure through', () => {
    const r = map(fail<number, string>('e'), x => x * 3);
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('e');
  });
});

describe('mapError', () => {
  it('transforms error value', () => {
    const r = mapError(fail('raw'), e => `wrapped:${e}`);
    expect((r as { error: string }).error).toBe('wrapped:raw');
  });

  it('passes success through', () => {
    const r = mapError(ok(5), e => `${e}!`);
    expect(isOk(r)).toBe(true);
    expect((r as { value: number }).value).toBe(5);
  });
});

describe('flatMap', () => {
  it('chains on success', () => {
    const r = flatMap(ok(3), x => ok(x + 1));
    expect((r as { value: number }).value).toBe(4);
  });

  it('short-circuits on failure', () => {
    const r = flatMap(fail<number, string>('e'), x => ok(x + 1));
    expect(isFail(r)).toBe(true);
  });
});

describe('flatMapAsync', () => {
  it('chains async on success', async () => {
    const r = await flatMapAsync(ok(3), async x => ok(x * 2));
    expect((r as { value: number }).value).toBe(6);
  });

  it('short-circuits async on failure', async () => {
    const called = vi.fn();
    await flatMapAsync(fail('e'), async x => { called(); return ok(x); });
    expect(called).not.toHaveBeenCalled();
  });
});

describe('mapAsync', () => {
  it('maps async on success', async () => {
    const r = await mapAsync(ok(10), async x => x + 5);
    expect((r as { value: number }).value).toBe(15);
  });

  it('passes failure through without calling fn', async () => {
    const called = vi.fn();
    await mapAsync(fail<number, string>('e'), async x => { called(); return x; });
    expect(called).not.toHaveBeenCalled();
  });
});

// ── Pattern matching ────────────────────────────────────────────────────────

describe('match / fold', () => {
  it('calls ok handler on success', () => {
    const msg = match(ok(42), { ok: v => `val:${v}`, fail: e => `err:${e}` });
    expect(msg).toBe('val:42');
  });

  it('calls fail handler on failure', () => {
    const msg = match(fail('oops'), { ok: v => `val:${v}`, fail: e => `err:${e}` });
    expect(msg).toBe('err:oops');
  });

  it('fold is an alias for match', () => {
    expect(fold).toBe(match);
  });
});

// ── Side effects ────────────────────────────────────────────────────────────

describe('tap / tapError', () => {
  it('tap calls fn on success', () => {
    const spy = vi.fn();
    tap(ok(1), spy);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('tap does not call fn on failure', () => {
    const spy = vi.fn();
    tap(fail('e'), spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('tapError calls fn on failure', () => {
    const spy = vi.fn();
    tapError(fail('oops'), spy);
    expect(spy).toHaveBeenCalledWith('oops');
  });

  it('tapError does not call fn on success', () => {
    const spy = vi.fn();
    tapError(ok(1), spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('tap returns the original result', () => {
    const r = ok(99);
    expect(tap(r, () => {})).toBe(r);
  });
});

// ── Unwrapping ──────────────────────────────────────────────────────────────

describe('unwrap / unwrapError / unwrapOr / unwrapOrElse / expect', () => {
  it('unwrap returns value on success', () => {
    expect(unwrap(ok(7))).toBe(7);
  });

  it('unwrap throws on failure', () => {
    expect(() => unwrap(fail(new Error('boom')))).toThrow('boom');
  });

  it('unwrapError returns error on failure', () => {
    expect(unwrapError(fail('err'))).toBe('err');
  });

  it('unwrapError throws on success', () => {
    expect(() => unwrapError(ok(1))).toThrow();
  });

  it('unwrapOr returns value on success', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
  });

  it('unwrapOr returns default on failure', () => {
    expect(unwrapOr(fail('e'), 99)).toBe(99);
  });

  it('unwrapOrElse calls fn on failure', () => {
    expect(unwrapOrElse(fail('e'), e => e.length)).toBe(1);
  });

  it('expect returns value on success', () => {
    expect(resultExpect(ok('hi'), 'should not throw')).toBe('hi');
  });

  it('expect throws with message on failure', () => {
    expect(() => resultExpect(fail('e'), 'custom msg')).toThrow('custom msg');
  });
});

// ── Conversion ──────────────────────────────────────────────────────────────

describe('toPromise / toNullable / toUndefined', () => {
  it('toPromise resolves on success', async () => {
    await expect(toPromise(ok('yes'))).resolves.toBe('yes');
  });

  it('toPromise rejects on failure', async () => {
    await expect(toPromise(fail(new Error('no')))).rejects.toThrow('no');
  });

  it('toNullable returns value on success', () => {
    expect(toNullable(ok(3))).toBe(3);
  });

  it('toNullable returns null on failure', () => {
    expect(toNullable(fail('e'))).toBeNull();
  });

  it('toUndefined returns value on success', () => {
    expect(toUndefined(ok(3))).toBe(3);
  });

  it('toUndefined returns undefined on failure', () => {
    expect(toUndefined(fail('e'))).toBeUndefined();
  });
});

// ── run / track / enrich / simplify ────────────────────────────────────────

describe('run', () => {
  it('captures async success', async () => {
    const r = await run(async () => 42);
    expect(isOk(r)).toBe(true);
    expect((r as { value: number }).value).toBe(42);
  });

  it('captures thrown exception', async () => {
    const r = await run(async () => { throw new Error('boom'); });
    expect(isFail(r)).toBe(true);
  });

  it('applies errorTransform', async () => {
    const r = await run<number, string>(
      async () => { throw new Error('raw'); },
      (e) => `mapped:${(e as Error).message}`,
    );
    expect((r as { error: string }).error).toBe('mapped:raw');
  });
});

describe('track', () => {
  it('captures success with metadata', async () => {
    const r = await track(() => 'value', { operation: 'test', tags: ['a'] });
    expect(isOk(r)).toBe(true);
    expect(isRich(r)).toBe(true);
    expect(r.operation).toBe('test');
    expect(r.tags).toEqual(['a']);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
    expect(r.timestamp).toMatch(/^\d{4}-/);
  });

  it('captures failure with metadata', async () => {
    const r = await track(() => { throw new Error('fail'); }, { operation: 'op' });
    expect(isFail(r)).toBe(true);
    expect(r.operation).toBe('op');
  });
});

describe('enrich / simplify', () => {
  it('enrich adds metadata to a plain result', () => {
    const r = enrich(ok(1), { operation: 'test' });
    expect(isRich(r)).toBe(true);
    expect(r.operation).toBe('test');
  });

  it('simplify strips metadata', async () => {
    const rich = await track(() => 42);
    const plain = simplify(rich);
    expect(isRich(plain)).toBe(false);
    expect(isOk(plain)).toBe(true);
  });
});
