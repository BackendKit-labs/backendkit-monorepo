import { describe, it, expect, vi } from 'vitest';
import { ok, fail, isOk, isFail, track, Flow } from '../../src/index.js';

describe('Flow', () => {
  describe('from / start', () => {
    it('Flow.from wraps a result', () => {
      const f = Flow.from(ok(5));
      expect(f.isOk()).toBe(true);
    });

    it('Flow.start creates an ok void pipeline', () => {
      const f = Flow.start();
      expect(f.isOk()).toBe(true);
    });
  });

  describe('map', () => {
    it('transforms success value', () => {
      const r = Flow.from(ok(3)).map(x => x * 2).getResult();
      expect((r as { value: number }).value).toBe(6);
    });

    it('skips on failure', () => {
      const spy = vi.fn();
      Flow.from(fail<number, string>('e')).map(x => { spy(); return x; }).getResult();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('mapError', () => {
    it('transforms error value', () => {
      const r = Flow.from(fail('raw')).mapError(e => `wrapped:${e}`).getResult();
      expect((r as { error: string }).error).toBe('wrapped:raw');
    });

    it('skips on success', () => {
      const spy = vi.fn();
      Flow.from(ok(1)).mapError(e => { spy(); return e; }).getResult();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('flatMap', () => {
    it('chains on success', () => {
      const r = Flow.from(ok(5)).flatMap(x => ok(x + 1)).getResult();
      expect((r as { value: number }).value).toBe(6);
    });

    it('short-circuits on failure', () => {
      const spy = vi.fn(() => ok(1));
      Flow.from(fail<number, string>('e')).flatMap(spy).getResult();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('filter', () => {
    it('keeps value when predicate passes', () => {
      const r = Flow.from(ok(10)).filter(x => x > 5, 'too small').getResult();
      expect(isOk(r)).toBe(true);
    });

    it('becomes failure when predicate fails', () => {
      const r = Flow.from(ok(2)).filter(x => x > 5, 'too small').getResult();
      expect(isFail(r)).toBe(true);
      expect((r as { error: string }).error).toBe('too small');
    });
  });

  describe('tap / tapError', () => {
    it('tap runs side effect on success', () => {
      const spy = vi.fn();
      Flow.from(ok(7)).tap(spy).getResult();
      expect(spy).toHaveBeenCalledWith(7);
    });

    it('tap skips on failure', () => {
      const spy = vi.fn();
      Flow.from(fail<number, string>('e')).tap(spy).getResult();
      expect(spy).not.toHaveBeenCalled();
    });

    it('tapError runs on failure', () => {
      const spy = vi.fn();
      Flow.from(fail('oops')).tapError(spy).getResult();
      expect(spy).toHaveBeenCalledWith('oops');
    });
  });

  describe('recover', () => {
    it('converts failure to success', () => {
      const r = Flow.from(fail<number, string>('e')).recover(e => e.length).getResult();
      expect(isOk(r)).toBe(true);
      expect((r as { value: number }).value).toBe(1);
    });

    it('skips on success', () => {
      const spy = vi.fn(() => 99);
      Flow.from(ok(5)).recover(spy).getResult();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('match', () => {
    it('calls ok handler', () => {
      const msg = Flow.from(ok(3)).match({ ok: v => `v:${v}`, fail: e => `e:${e}` });
      expect(msg).toBe('v:3');
    });

    it('calls fail handler', () => {
      const msg = Flow.from(fail('oops')).match({ ok: v => `v:${v}`, fail: e => `e:${e}` });
      expect(msg).toBe('e:oops');
    });
  });

  describe('chaining', () => {
    it('supports a full pipeline', () => {
      const tapped: number[] = [];
      const r = Flow.from(ok(10))
        .map(x => x + 5)
        .filter(x => x > 10, 'too small')
        .tap(x => tapped.push(x))
        .map(x => x * 2)
        .getResult();

      expect(isOk(r)).toBe(true);
      expect((r as { value: number }).value).toBe(30);
      expect(tapped).toEqual([15]);
    });

    it('propagates failure through pipeline', () => {
      const spy = vi.fn();
      const r = Flow.from(ok(1))
        .filter(x => x > 10, 'too small')
        .map(x => { spy(); return x * 2; })
        .getResult();

      expect(isFail(r)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getRichResult', () => {
    it('returns RichResult when built from track()', async () => {
      const rich = await track(() => 42, { operation: 'test' });
      const f = Flow.from(rich);
      expect(f.getRichResult().operation).toBe('test');
    });

    it('throws when result is not rich', () => {
      expect(() => Flow.from(ok(1)).getRichResult()).toThrow();
    });
  });
});
