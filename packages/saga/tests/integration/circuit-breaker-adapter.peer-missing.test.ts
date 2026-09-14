// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/circuit-breaker-adapter.peer-missing.test.ts
//
// Isolated from circuit-breaker-adapter.test.ts because it mocks the whole
// @backendkit-labs/circuit-breaker module to simulate the optional peer not
// being installed.
// ---------------------------------------------------------------------------

import { vi } from 'vitest';

vi.mock('@backendkit-labs/circuit-breaker', () => {
  throw new Error('Cannot find package @backendkit-labs/circuit-breaker');
});

describe('SagaCircuitBreaker when @backendkit-labs/circuit-breaker is not installed', () => {
  it('surfaces a clear, actionable error instead of a raw module-not-found', async () => {
    const { SagaCircuitBreaker } = await import('../../src/integration/circuit-breaker-adapter');
    const cb = new SagaCircuitBreaker();

    await expect(cb.getState()).rejects.toThrow(
      '@backendkit-labs/circuit-breaker is required to use SagaCircuitBreaker. ' +
      'Install it: npm install @backendkit-labs/circuit-breaker',
    );
  });
});
