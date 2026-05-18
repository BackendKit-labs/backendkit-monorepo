/**
 * @backendkit-labs/circuit-breaker vs opossum
 *
 * Measures overhead per call in CLOSED and OPEN states.
 * Both breakers wrap the same minimal async function.
 */
import { Bench } from 'tinybench';
import { CircuitBreaker as BKCircuitBreaker } from '@backendkit-labs/circuit-breaker';
import OpossumCircuitBreaker from 'opossum';

export const BENCH_TIME_MS  = 3_000;
export const WARMUP_TIME_MS = 500;

const ASYNC_FN = async (): Promise<string> => 'ok';

// Pre-build opossum breaker (constructing inside bench loop skews results)
function makeOpossum(opts: { errorThresholdPercentage: number } = { errorThresholdPercentage: 50 }) {
  return new OpossumCircuitBreaker(ASYNC_FN, {
    timeout:                   3_000,
    errorThresholdPercentage:  opts.errorThresholdPercentage,
    resetTimeout:              30_000,
    volumeThreshold:           1,
  });
}

async function benchClosed() {
  const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });

  const bk = new BKCircuitBreaker({ name: 'bk-closed', failureThreshold: 50, openTimeoutMs: 30_000 });
  const op = makeOpossum();

  bench
    .add('@backendkit-labs/circuit-breaker', async () => {
      await bk.execute(ASYNC_FN);
    })
    .add('opossum', async () => {
      await op.fire();
    });

  await bench.warmup();
  await bench.run();
  return bench;
}

async function benchOpen() {
  const bench = new Bench({ time: BENCH_TIME_MS, warmupTime: WARMUP_TIME_MS });

  // Trip our CB: inject enough failures to open it
  const bk = new BKCircuitBreaker({
    name:             'bk-open',
    failureThreshold: 1,
    openTimeoutMs:    60_000,
    windowSize:       1,
  });
  try { await bk.execute(async () => { throw new Error('trip'); }); } catch { /* expected */ }

  // Trip opossum: use 1% threshold so a single failure opens it
  const FAIL_FN = async (): Promise<never> => { throw new Error('trip'); };
  const op = new OpossumCircuitBreaker(FAIL_FN, {
    timeout:                  3_000,
    errorThresholdPercentage: 1,
    resetTimeout:             60_000,
    volumeThreshold:          1,
  });
  try { await op.fire(); } catch { /* expected */ }

  bench
    .add('@backendkit-labs/circuit-breaker (open — fast-fail)', async () => {
      try { await bk.execute(ASYNC_FN); } catch { /* fast-fail — expected */ }
    })
    .add('opossum (open — fast-fail)', async () => {
      try { await op.fire(); } catch { /* fast-fail — expected */ }
    });

  await bench.warmup();
  await bench.run();
  return bench;
}

export async function run() {
  console.log('\n### Circuit Breaker — CLOSED state (async fn, no failures)\n');
  const closed = await benchClosed();
  console.table(closed.table());

  console.log('\n### Circuit Breaker — OPEN state (fast-fail)\n');
  const open = await benchOpen();
  console.table(open.table());

  return { closed, open };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  run().catch(console.error);
}
