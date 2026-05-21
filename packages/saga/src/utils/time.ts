// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/utils/time.ts
//
// Time utilities: current timestamp, cancellable timer (no global leak).
// ---------------------------------------------------------------------------

export function currentTimestamp(): number {
  return Date.now();
}

export interface Timer {
  promise: Promise<void>;
  cancel(): void;
}

export function createTimer(timeoutMs: number): Timer {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;

  const promise = new Promise<void>((_, reject) => {
    rejectPromise = reject;
    timerId = setTimeout(() => {
      reject(new Error('Timer timed out'));
      timerId = undefined;
      rejectPromise = undefined;
    }, timeoutMs);
  });

  return {
    promise,
    cancel(): void {
      if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
      }
      if (rejectPromise !== undefined) {
        rejectPromise(new Error('Timer cancelled'));
        rejectPromise = undefined;
      }
    },
  };
}
