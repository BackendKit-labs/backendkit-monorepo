import { describe, it, expect, vi } from 'vitest';
import {
  ok, fail, isOk, isFail,
  all, any, parallel, partition, collect, traverse, combine2, combine3,
} from '../../src/index.js';

describe('all', () => {
  it('returns ok with all values when all succeed', () => {
    const r = all([ok(1), ok(2), ok(3)]);
    expect(isOk(r)).toBe(true);
    expect((r as { value: number[] }).value).toEqual([1, 2, 3]);
  });

  it('short-circuits on first failure', () => {
    const r = all([ok(1), fail('boom'), ok(3)]);
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('boom');
  });

  it('returns ok([]) for empty array', () => {
    const r = all([]);
    expect(isOk(r)).toBe(true);
    expect((r as { value: unknown[] }).value).toEqual([]);
  });
});

describe('any', () => {
  it('returns the first success', async () => {
    const r = await any([
      async () => fail<number, string>('a'),
      async () => ok(42),
      async () => ok(99),
    ]);
    expect(isOk(r)).toBe(true);
    expect((r as { value: number }).value).toBe(42);
  });

  it('returns the last failure if all fail', async () => {
    const r = await any([
      async () => fail('first'),
      async () => fail('last'),
    ]);
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('last');
  });

  it('does not call subsequent ops after first success', async () => {
    const spy = vi.fn().mockResolvedValue(ok(1));
    await any([async () => ok(0), spy]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('parallel', () => {
  it('runs all ops and collects values', async () => {
    const r = await parallel([
      async () => ok(1),
      async () => ok(2),
      async () => ok(3),
    ]);
    expect(isOk(r)).toBe(true);
    expect((r as { value: number[] }).value).toEqual([1, 2, 3]);
  });

  it('returns first failure', async () => {
    const r = await parallel([
      async () => ok(1),
      async () => fail('boom'),
    ]);
    expect(isFail(r)).toBe(true);
  });

  it('respects concurrency limit', async () => {
    const started: number[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;

    const ops = [1, 2, 3, 4].map(i => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      started.push(i);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return ok(i);
    });

    await parallel(ops, { concurrency: 2 });
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  }, 5000);
});

describe('partition', () => {
  it('splits into successes and failures', () => {
    const [values, errors] = partition([ok(1), fail('a'), ok(2), fail('b')]);
    expect(values).toEqual([1, 2]);
    expect(errors).toEqual(['a', 'b']);
  });

  it('handles all successes', () => {
    const [values, errors] = partition([ok(1), ok(2)]);
    expect(values).toEqual([1, 2]);
    expect(errors).toEqual([]);
  });

  it('handles all failures', () => {
    const [values, errors] = partition([fail('x'), fail('y')]);
    expect(values).toEqual([]);
    expect(errors).toEqual(['x', 'y']);
  });
});

describe('collect', () => {
  it('returns only success values', () => {
    expect(collect([ok(1), fail('e'), ok(3)])).toEqual([1, 3]);
  });

  it('returns empty array if all fail', () => {
    expect(collect([fail('a'), fail('b')])).toEqual([]);
  });
});

describe('traverse', () => {
  it('maps all items and collects values', () => {
    const r = traverse([1, 2, 3], x => ok(x * 2));
    expect(isOk(r)).toBe(true);
    expect((r as { value: number[] }).value).toEqual([2, 4, 6]);
  });

  it('short-circuits on first failure', () => {
    const r = traverse([1, 2, 3], x => x === 2 ? fail('bad') : ok(x));
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('bad');
  });
});

describe('combine2 / combine3', () => {
  it('combine2 returns typed tuple on success', () => {
    const r = combine2(ok('a'), ok(1));
    expect(isOk(r)).toBe(true);
    expect((r as { value: [string, number] }).value).toEqual(['a', 1]);
  });

  it('combine2 short-circuits on first failure', () => {
    const r = combine2(fail('x'), ok(1));
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('x');
  });

  it('combine3 returns typed triple on success', () => {
    const r = combine3(ok(1), ok('b'), ok(true));
    expect(isOk(r)).toBe(true);
    expect((r as { value: [number, string, boolean] }).value).toEqual([1, 'b', true]);
  });

  it('combine3 short-circuits on second failure', () => {
    const r = combine3(ok(1), fail('mid'), ok(3));
    expect(isFail(r)).toBe(true);
  });
});
