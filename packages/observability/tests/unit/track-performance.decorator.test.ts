import { describe, it, expect } from 'vitest';
import { TrackPerformance }     from '../../src/decorators/track-performance.decorator.js';

describe('@TrackPerformance', () => {
  it('does not alter the return value of a successful method', async () => {
    class Svc {
      @TrackPerformance()
      async getValue(): Promise<number> { return 42; }
    }
    const result = await new Svc().getValue();
    expect(result).toBe(42);
  });

  it('rethrows errors from the decorated method', async () => {
    class Svc {
      @TrackPerformance({ operation: 'Svc.fail' })
      async fail(): Promise<void> { throw new Error('expected'); }
    }
    await expect(new Svc().fail()).rejects.toThrow('expected');
  });

  it('accepts attributes option without throwing', async () => {
    class Svc {
      @TrackPerformance({ attributes: { team: 'backend' } })
      async ok(): Promise<string> { return 'ok'; }
    }
    expect(await new Svc().ok()).toBe('ok');
  });

  it('works when OTel is not installed (noopTracer)', async () => {
    // otel shim is a no-op in test env — this just proves it does not throw
    class Svc {
      @TrackPerformance()
      async noop(): Promise<boolean> { return true; }
    }
    expect(await new Svc().noop()).toBe(true);
  });
});
