/**
 * Minimal example — @backendkit-labs/pipeline
 *
 * Run:  npm install && npm start
 *
 * The problem with procedural order processing:
 *   - Each step is a nested if/else or try/catch — hard to add or reorder steps
 *   - No built-in observability hooks (which step ran? how long?)
 *   - Error handling is mixed with business logic
 *
 * Pipeline separates each step into its own class:
 *   - Steps are composable and reorderable
 *   - stop-on-first: halt at the first failure (default)
 *   - collect-all: run all steps and collect every failure
 *   - Built-in hooks for logging, metrics, and tracing
 */

import { pipeline, Ok, Err } from '@backendkit-labs/pipeline';
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';

// ── Context & error types ─────────────────────────────────────────────────────

interface OrderCtx {
  items:           Array<{ sku: string; qty: number; price: number }>;
  customerId:      string;
  total?:          number;
  transactionId?:  string;
  shipmentId?:     string;
}

type OrderError =
  | { kind: 'validation-failed'; reason: string }
  | { kind: 'payment-failed';    reason: string }
  | { kind: 'shipping-failed';   reason: string };

// ── Steps ─────────────────────────────────────────────────────────────────────

class ValidateOrder implements PipelineStep<OrderCtx, OrderError> {
  readonly stepName = 'validate-order';

  async handle(ctx: OrderCtx): Promise<StepResult<OrderCtx, OrderError>> {
    if (ctx.items.length === 0)
      return Err({ kind: 'validation-failed', reason: 'Order has no items' });

    const hasInvalidQty = ctx.items.some(i => i.qty <= 0);
    if (hasInvalidQty)
      return Err({ kind: 'validation-failed', reason: 'All quantities must be > 0' });

    const total = ctx.items.reduce((sum, i) => sum + i.qty * i.price, 0);
    return Ok({ ...ctx, total });
  }
}

class ChargePayment implements PipelineStep<OrderCtx, OrderError> {
  readonly stepName = 'charge-payment';

  async handle(ctx: OrderCtx): Promise<StepResult<OrderCtx, OrderError>> {
    await new Promise(r => setTimeout(r, 80)); // simulate gateway latency

    if (Math.random() < 0.3)
      return Err({ kind: 'payment-failed', reason: 'Insufficient funds' });

    return Ok({ ...ctx, transactionId: `txn-${Date.now()}` });
  }
}

class CreateShipment implements PipelineStep<OrderCtx, OrderError> {
  readonly stepName = 'create-shipment';

  async handle(ctx: OrderCtx): Promise<StepResult<OrderCtx, OrderError>> {
    await new Promise(r => setTimeout(r, 50));
    return Ok({ ...ctx, shipmentId: `ship-${Date.now()}` });
  }
}

// ── Pipeline setup ────────────────────────────────────────────────────────────

const orderPipeline = pipeline<OrderCtx, OrderError>({
  mode: 'stop-on-first',
  onStep:         (name)             => console.log(`  → running: ${name}`),
  onStepComplete: (name, _, ms)      => console.log(`    ✓ done in ${ms}ms`),
  onError:        (name, err)        => console.log(`    ✗ failed: ${JSON.stringify(err)}`),
})
  .pipe(new ValidateOrder())
  .pipe(new ChargePayment())
  .pipe(new CreateShipment());

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(label: string, ctx: OrderCtx) {
  console.log(`\n── ${label} ${'─'.repeat(50 - label.length)}`);
  const result = await orderPipeline.run(ctx);

  if (result.ok) {
    const { total, transactionId, shipmentId, durationMs } = { ...result.value, durationMs: result.durationMs };
    console.log(`\n  ✓ Order fulfilled in ${durationMs}ms`);
    console.log(`    total       : $${((total ?? 0) / 100).toFixed(2)}`);
    console.log(`    transaction : ${transactionId}`);
    console.log(`    shipment    : ${shipmentId}`);
  } else {
    const { failedStep, cause, executedSteps, durationMs } = result.error;
    console.log(`\n  ✗ Failed at "${failedStep}" after ${durationMs}ms`);
    console.log(`    reason         : ${cause.kind} — ${cause.reason}`);
    console.log(`    completed steps: ${executedSteps.join(' → ') || 'none'}`);
  }
}

async function main() {
  // Happy path
  await run('Valid order', {
    customerId: 'cust-1',
    items: [
      { sku: 'HDPH-01', qty: 1, price: 8999 },
      { sku: 'KBRD-02', qty: 2, price: 12999 },
    ],
  });

  // Validation failure — pipeline stops immediately, payment never called
  await run('Invalid order (empty items)', {
    customerId: 'cust-2',
    items: [],
  });

  // Payment failure (30% chance) — run a few times to see it fail
  await run('Order with flaky payment', {
    customerId: 'cust-3',
    items: [{ sku: 'TSHIRT-M', qty: 3, price: 2999 }],
  });
}

main().catch(console.error);
