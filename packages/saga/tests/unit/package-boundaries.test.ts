// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/unit/package-boundaries.test.ts
//
// Regression guard: the main entry point (src/index.ts) must never
// re-export anything from ./nestjs.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('package entry point boundaries', () => {
  it('src/index.ts does not import from ./nestjs', () => {
    // @nestjs/common, @nestjs/core, and rxjs are optional peer dependencies.
    // src/index.ts previously re-exported SagaModule, SagaOrchestrator, the
    // @Saga/@Step/@Compensate decorators, etc. from ./nestjs -- which made
    // this package's main dist/index.d.ts require @nestjs/common and rxjs
    // type declarations to exist, even for consumers who only use the core
    // in-memory saga engine and never touch NestJS. A consumer without those
    // installed got "Cannot find module '@nestjs/common' or its
    // corresponding type declarations" just from
    // `import { SagaBuilder } from '@backendkit-labs/saga'`.
    //
    // NestJS integration must stay exclusively under the './nestjs' subpath
    // (@backendkit-labs/saga/nestjs), matching every other BackendKit
    // package (circuit-breaker, retry, http-client, ...).
    const indexSource = readFileSync(join(__dirname, '../../src/index.ts'), 'utf-8');
    expect(indexSource).not.toMatch(/from\s+['"]\.\/nestjs['"]/);
  });
});
