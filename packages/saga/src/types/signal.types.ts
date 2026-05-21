// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/signal.types.ts
//
// WaitForSignal: marker returned by a step to pause the saga durably until
// an external event arrives via engine.signal(token, payload).
// ---------------------------------------------------------------------------

const WAIT_BRAND = Symbol('WaitForSignal');

export interface WaitForSignalResult {
  readonly _brand: typeof WAIT_BRAND;
  readonly token: string;
  readonly timeoutMs?: number;  // if set, saga fails with STEP_TIMEOUT after this duration
}

export function waitForSignal(token: string, timeoutMs?: number): WaitForSignalResult {
  return { _brand: WAIT_BRAND, token, timeoutMs };
}

export function isWaitForSignal(value: unknown): value is WaitForSignalResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_brand' in value &&
    (value as WaitForSignalResult)._brand === WAIT_BRAND
  );
}
