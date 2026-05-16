import { describe, it, expect } from 'vitest';
import { HttpClientModule } from '../../src/nestjs/http-client.module.js';
import { defineHttpClient } from '../../src/core/types.js';
import type { Provider } from '@nestjs/common';

// ── forRoot ───────────────────────────────────────────────────────────────────

describe('HttpClientModule.forRoot', () => {
  it('creates one provider per client token', () => {
    const USERS    = defineHttpClient('users');
    const PAYMENTS = defineHttpClient('payments');

    const mod = HttpClientModule.forRoot({
      clients: [
        { token: USERS,    config: { baseURL: 'https://users.api' } },
        { token: PAYMENTS, config: { baseURL: 'https://payments.api' } },
      ],
    });

    const provides = providerTokens(mod.providers ?? []);
    expect(provides).toContain(USERS.symbol);
    expect(provides).toContain(PAYMENTS.symbol);
  });

  it('marks the module as global', () => {
    const mod = HttpClientModule.forRoot({ clients: [] });
    expect(mod.global).toBe(true);
  });
});

// ── forRootAsync ──────────────────────────────────────────────────────────────

describe('HttpClientModule.forRootAsync', () => {
  it('creates one provider per declared token so @InjectHttpClient works', () => {
    const USERS    = defineHttpClient('users');
    const PAYMENTS = defineHttpClient('payments');

    const mod = HttpClientModule.forRootAsync({
      clients: [USERS, PAYMENTS],
      useFactory: () => ({
        clients: [
          { token: USERS,    config: { baseURL: 'https://users.api' } },
          { token: PAYMENTS, config: { baseURL: 'https://payments.api' } },
        ],
      }),
    });

    const provides = providerTokens(mod.providers ?? []);
    expect(provides).toContain(USERS.symbol);
    expect(provides).toContain(PAYMENTS.symbol);
  });

  it('marks the module as global', () => {
    const mod = HttpClientModule.forRootAsync({
      clients: [],
      useFactory: () => ({ clients: [] }),
    });
    expect(mod.global).toBe(true);
  });

  it('includes provided imports in the returned module', () => {
    class FakeModule {}
    const mod = HttpClientModule.forRootAsync({
      clients: [],
      imports: [FakeModule],
      useFactory: () => ({ clients: [] }),
    });
    expect(mod.imports).toContain(FakeModule);
  });

  it('client factory throws when token is not found in resolved options', async () => {
    const ORPHAN = defineHttpClient('orphan');

    const mod = HttpClientModule.forRootAsync({
      clients: [ORPHAN],
      useFactory: () => ({ clients: [] }), // factory returns no config for ORPHAN
    });

    // Find the provider for ORPHAN and call its factory directly
    const orphanProvider = (mod.providers ?? []).find(
      (p): p is Extract<Provider, { provide: symbol; useFactory: Function }> =>
        typeof p === 'object' && 'provide' in p && p.provide === ORPHAN.symbol,
    );

    expect(orphanProvider).toBeDefined();
    expect(() =>
      (orphanProvider as any).useFactory({ clients: [] }),
    ).toThrow(`HttpClient config not found for '${ORPHAN.description}'`);
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

function providerTokens(providers: Provider[]): unknown[] {
  return providers
    .filter((p): p is Extract<Provider, { provide: unknown }> =>
      typeof p === 'object' && p !== null && 'provide' in p,
    )
    .map(p => p.provide);
}
