import { ok, fail, run, match, map, retry, withTimeout } from '@backendkit-labs/result';

// ── 1. Constructors ──────────────────────────────────────────────────────────

const success = ok(42);
const failure = fail('something went wrong');

console.log('ok:  ', success); // { ok: true,  value: 42 }
console.log('fail:', failure); // { ok: false, error: 'something went wrong' }

// ── 2. Wrapping throwable calls ──────────────────────────────────────────────

async function fetchUser(id: string) {
  if (id === 'invalid') throw new Error(`User '${id}' not found`);
  return { id, name: 'Alice', email: 'alice@example.com' };
}

const result = await run(() => fetchUser('123'));

// match() handles both branches — no if/else chains
const message = match(result, {
  ok:   (user) => `Welcome, ${user.name}! (${user.email})`,
  fail: (err)  => `Error: ${err.message}`,
});
console.log('\nmatch():', message);

// ── 3. Transforming values ───────────────────────────────────────────────────

const nameResult = map(result, (user) => user.name.toUpperCase());
console.log('map():', nameResult); // { ok: true, value: 'ALICE' }

// ── 4. Retry ─────────────────────────────────────────────────────────────────

let attempt = 0;
const retried = await retry(
  async () => {
    attempt++;
    if (attempt < 3) return fail(new Error(`attempt ${attempt} failed`));
    return ok('succeeded on attempt 3');
  },
  { attempts: 5, delayMs: 50 },
);
console.log('\nretry():', retried); // { ok: true, value: 'succeeded on attempt 3' }

// ── 5. Timeout ───────────────────────────────────────────────────────────────

const fast = await withTimeout(
  async () => ok('fast response'),
  1000,
  new Error('timed out'),
);
console.log('withTimeout() fast:', fast); // { ok: true, value: 'fast response' }

const slow = await withTimeout(
  () => new Promise<typeof ok<string>>((r) => setTimeout(() => r(ok('too late')), 300)),
  100,
  new Error('timed out after 100ms'),
);
console.log('withTimeout() slow:', slow); // { ok: false, error: Error: timed out after 100ms }
