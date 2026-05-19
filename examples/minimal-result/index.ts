/**
 * Minimal example — @backendkit-labs/result
 *
 * Run:  npm install && npm start
 *
 * The problem with try/catch:
 *   - The error type is `unknown` — the compiler can't tell you what failed
 *   - Callers can ignore the error and crash at runtime
 *   - No way to enforce error handling at compile time
 *
 * Result<T, E> solves this:
 *   - The error is part of the return type — impossible to ignore
 *   - TypeScript narrows the type on both branches
 *   - No exceptions, no surprises
 */

import { ok, fail, match } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';

// ── Domain types ──────────────────────────────────────────────────────────────

type Product = { id: string; name: string; price: number };

type ProductError =
  | { kind: 'not-found';      id: string }
  | { kind: 'db-unavailable'; reason: string };

// ── Fake database ─────────────────────────────────────────────────────────────

const DB: Record<string, Product> = {
  'p-1': { id: 'p-1', name: 'Wireless Headphones', price: 8999 },
  'p-2': { id: 'p-2', name: 'Mechanical Keyboard',  price: 12999 },
};

// ── Service function ──────────────────────────────────────────────────────────
//
// Traditional style would throw — callers can't see the error in the signature:
//
//   async function findProduct(id: string): Promise<Product> {
//     if (Math.random() < 0.2) throw new Error('DB connection failed');
//     const product = DB[id];
//     if (!product) throw new Error(`Product ${id} not found`);
//     return product;
//   }
//
// With Result, the error is explicit and the caller is forced to handle it:

async function findProduct(id: string): Promise<Result<Product, ProductError>> {
  if (Math.random() < 0.2)
    return fail({ kind: 'db-unavailable', reason: 'Connection timeout' });

  const product = DB[id];
  if (!product)
    return fail({ kind: 'not-found', id });

  return ok(product);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const ids = ['p-1', 'p-99', 'p-2', 'p-3'];

  for (const id of ids) {
    const result = await findProduct(id);

    match(result, {
      ok: (product) => console.log(`✓  ${product.name} — $${(product.price / 100).toFixed(2)}`),
      fail: (error) => {
        if (error.kind === 'not-found')      console.log(`✗  Product "${error.id}" does not exist`);
        if (error.kind === 'db-unavailable') console.log(`✗  Database unavailable — ${error.reason}`);
      },
    });
  }
}

main().catch(console.error);
