/**
 * @backendkit-labs/result vs neverthrow
 *
 * API note: neverthrow uses method chaining (result.map(fn)),
 * while @backendkit-labs/result uses free functions (map(result, fn)).
 * Both patterns are benchmarked on equivalent operations.
 */
import { Bench } from 'tinybench';
import { ok as bkOk, fail as bkFail, map, flatMap, match } from '@backendkit-labs/result';
import { ok as ntOk, err as ntErr } from 'neverthrow';

export const BENCH_TIME_MS  = 2_000;
export const WARMUP_TIME_MS = 300;

export async function run() {
  // ── Construction ────────────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    bench
      .add('bk ok()',       () => bkOk('hello'))
      .add('bk fail()',     () => bkFail(new Error('oops')))
      .add('nt ok()',       () => ntOk('hello'))
      .add('nt err()',      () => ntErr(new Error('oops')));
    await bench.warmup();
    await bench.run();
    console.log('\n### Result — construction\n');
    console.table(bench.table());
  }

  // ── map() chain × 5 ────────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    const bkStart = bkOk(0);
    const ntStart = ntOk(0);
    const inc = (n: number) => n + 1;

    bench
      .add('bk map ×5', () => {
        const r0 = map(bkStart, inc);
        const r1 = map(r0, inc);
        const r2 = map(r1, inc);
        const r3 = map(r2, inc);
        map(r3, inc);
      })
      .add('nt map ×5', () => {
        ntStart
          .map(inc)
          .map(inc)
          .map(inc)
          .map(inc)
          .map(inc);
      });
    await bench.warmup();
    await bench.run();
    console.log('\n### Result — map() chain ×5\n');
    console.table(bench.table());
  }

  // ── flatMap() chain × 3 ────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    const bkStart = bkOk(0);
    const ntStart = ntOk(0);
    const step = (n: number) => bkOk(n + 1);
    const ntStep = (n: number) => ntOk(n + 1);

    bench
      .add('bk flatMap ×3', () => {
        const r0 = flatMap(bkStart, step);
        const r1 = flatMap(r0, step);
        flatMap(r1, step);
      })
      .add('nt andThen ×3', () => {
        ntStart
          .andThen(ntStep)
          .andThen(ntStep)
          .andThen(ntStep);
      });
    await bench.warmup();
    await bench.run();
    console.log('\n### Result — flatMap() chain ×3\n');
    console.table(bench.table());
  }

  // ── Pattern matching ───────────────────────────────────────────────────────
  {
    const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });
    const bkOkVal  = bkOk('hello');
    const bkErrVal = bkFail(new Error('x'));
    const ntOkVal  = ntOk('hello');
    const ntErrVal = ntErr(new Error('x'));

    bench
      .add('bk match() ok',    () => match(bkOkVal,  { ok: v => v.length, fail: () => 0 }))
      .add('bk match() fail',  () => match(bkErrVal, { ok: v => (v as string).length, fail: () => 0 }))
      .add('nt match() ok',    () => ntOkVal.match(v => v.length, () => 0))
      .add('nt match() fail',  () => ntErrVal.match(v => (v as string).length, () => 0));
    await bench.warmup();
    await bench.run();
    console.log('\n### Result — pattern matching\n');
    console.table(bench.table());
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  run().catch(console.error);
}
