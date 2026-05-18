/**
 * @backendkit-labs/result vs raw try/catch
 *
 * Measures the overhead of explicit error handling via Result
 * compared to the native try/catch mechanism.
 */
import { Bench } from 'tinybench';
import { ok, fail, fromThrowable, unwrap, unwrapOr } from '@backendkit-labs/result';

export const BENCH_TIME_MS  = 2_000;
export const WARMUP_TIME_MS = 300;

function parseIntSafe(s: string) {
  const n = parseInt(s, 10);
  if (isNaN(n)) throw new Error('not a number');
  return n;
}

export async function run() {
  // ── Success path ───────────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    bench
      .add('try/catch — success', () => {
        try { return parseIntSafe('42'); } catch { return 0; }
      })
      .add('fromThrowable — success', () => {
        const r = fromThrowable(() => parseIntSafe('42'));
        return unwrapOr(r, 0);
      })
      .add('ok() + unwrap — success', () => {
        const r = ok(42);
        return unwrap(r);
      });
    await bench.warmup();
    await bench.run();
    console.log('\n### Result vs try/catch — success path\n');
    console.table(bench.table());
  }

  // ── Error path ─────────────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    bench
      .add('try/catch — error', () => {
        try { return parseIntSafe('NaN'); } catch { return 0; }
      })
      .add('fromThrowable — error', () => {
        const r = fromThrowable(() => parseIntSafe('NaN'));
        return unwrapOr(r, 0);
      })
      .add('fail() + unwrapOr — error', () => {
        const r = fail(new Error('not a number'));
        return unwrapOr(r, 0);
      });
    await bench.warmup();
    await bench.run();
    console.log('\n### Result vs try/catch — error path\n');
    console.table(bench.table());
  }

  // ── if/else vs match ───────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    const r = ok<number, Error>(42);

    bench
      .add('if result.ok', () => {
        if (r.ok) return r.value * 2;
        return 0;
      })
      .add('unwrapOr', () => unwrapOr(r, 0) * 2);
    await bench.warmup();
    await bench.run();
    console.log('\n### Result — branching patterns\n');
    console.table(bench.table());
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  run().catch(console.error);
}
