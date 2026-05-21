import { RecoveryEngine } from '../../../src/recovery/recovery-engine';
import { SagaScanner } from '../../../src/recovery/saga-scanner';
import type { SagaStore } from '../../../src/persistence/saga-store.interface';
import type { SagaEngine } from '../../../src/core/saga-engine';

vi.mock('../../../src/recovery/recovery-engine');

describe('SagaScanner', () => {
  let store: Mocked<SagaStore>;
  let engine: Mocked<SagaEngine>;
  let recoverCrashedSagasMock: Mock;

  beforeEach(() => {
    store = {
      save: vi.fn(),
      load: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    };

    engine = {
      define: vi.fn(),
      create: vi.fn(),
      run: vi.fn(),
      getStatus: vi.fn(),
      list: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    } as any;

    recoverCrashedSagasMock = vi.fn().mockResolvedValue({ ok: true, value: 3 });
    (RecoveryEngine as Mock).mockImplementation(() => ({
      recoverCrashedSagas: recoverCrashedSagasMock,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start periodic scanning with given interval', () => {
    vi.useFakeTimers();

    const scanner = new SagaScanner(store, engine as any, 5000);
    scanner.start();

    expect(recoverCrashedSagasMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);

    expect(recoverCrashedSagasMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);

    expect(recoverCrashedSagasMock).toHaveBeenCalledTimes(2);
  });

  it('should call recoverCrashedSagas repeatedly', () => {
    vi.useFakeTimers();

    const scanner = new SagaScanner(store, engine as any, 1000);
    scanner.start();

    vi.advanceTimersByTime(3000);

    expect(recoverCrashedSagasMock).toHaveBeenCalledTimes(3);
  });

  it('should stop scanning when stop() is called', () => {
    vi.useFakeTimers();

    const scanner = new SagaScanner(store, engine as any, 1000);
    scanner.start();

    vi.advanceTimersByTime(2500);
    expect(recoverCrashedSagasMock).toHaveBeenCalledTimes(2);

    scanner.stop();

    vi.advanceTimersByTime(5000);
    // Should not increase after stop
    expect(recoverCrashedSagasMock).toHaveBeenCalledTimes(2);
  });

  it('should not start a second interval if already running', () => {
    vi.useFakeTimers();

    const scanner = new SagaScanner(store, engine as any, 1000);
    scanner.start();
    scanner.start(); // second call

    vi.advanceTimersByTime(1000);

    // Should only have been called once (one interval)
    expect(recoverCrashedSagasMock).toHaveBeenCalledTimes(1);
  });

  it('should be safe to stop without starting', () => {
    const scanner = new SagaScanner(store, engine as any, 1000);

    expect(() => scanner.stop()).not.toThrow();
  });

  it('should catch errors from recovery engine without crashing', async () => {
    vi.useFakeTimers();

    // Use a promise that rejects to simulate an error
    recoverCrashedSagasMock.mockImplementation(() => {
      const error = new Error('scan failed');
      return Promise.reject(error);
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const scanner = new SagaScanner(store, engine as any, 100);
    scanner.start();

    vi.advanceTimersByTime(100);
    // Flush microtasks (the .catch handler runs as a microtask)
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SagaScanner] Recovery scan failed:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
