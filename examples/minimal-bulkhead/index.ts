/**
 * Minimal example — @backendkit-labs/bulkhead
 *
 * Run:  npm install && npm start
 *
 * The problem with Promise.all():
 *   - All tasks fire simultaneously — can overwhelm downstream services
 *   - No control over concurrency, no queue, no backpressure
 *
 * Bulkhead limits how many operations run at the same time.
 * Excess tasks queue up and execute as slots free, preventing overload.
 */

import { Bulkhead } from '@backendkit-labs/bulkhead';

// ── Simulated image resizing — each takes ~300ms ──────────────────────────────

async function resizeImage(id: number): Promise<string> {
  await new Promise(r => setTimeout(r, 250 + Math.random() * 100));
  return `image-${id}.webp`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const items = Array.from({ length: 16 }, (_, i) => i + 1);

  // Without bulkhead: all 16 fire at once
  console.log('WITHOUT bulkhead — all 16 images processed simultaneously:');
  const t1 = Date.now();
  const results1 = await Promise.all(items.map(id => resizeImage(id)));
  console.log(`  ${results1.length} images done in ${Date.now() - t1}ms`);
  console.log(`  (server handled 16 concurrent operations at once)\n`);

  // With bulkhead: max 3 concurrent, rest queue up
  const bulkhead = new Bulkhead({
    name:               'image-resizer',
    maxConcurrentCalls: 3,
    maxQueueSize:       20,
    queueTimeoutMs:     15_000,
    rejectWhenFull:     false,
  });

  console.log('WITH bulkhead (max 3 concurrent) — same 16 images:');
  const t2 = Date.now();
  const results2 = await Promise.all(
    items.map(id => bulkhead.execute(() => resizeImage(id))),
  );
  console.log(`  ${results2.length} images done in ${Date.now() - t2}ms`);
  console.log(`  (server never had more than 3 concurrent operations)\n`);

  const m = bulkhead.getMetrics();
  console.log('Bulkhead metrics:');
  console.log(`  successful calls : ${m.successfulCalls}`);
  console.log(`  rejected calls   : ${m.rejectedCalls}`);
  console.log(`  avg duration     : ${m.averageDurationMs}ms`);
}

main().catch(console.error);
