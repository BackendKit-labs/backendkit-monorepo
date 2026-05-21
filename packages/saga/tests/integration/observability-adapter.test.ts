// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/observability-adapter.test.ts
//
// Integration tests for ConsoleSagaLogger, NoopSagaMetrics and
// SagaObservability.
// ---------------------------------------------------------------------------

import type { MockInstance, Mocked } from 'vitest';
import {
  ConsoleSagaLogger,
  NoopSagaMetrics,
  SagaObservability,
} from '../../src/integration/observability-adapter';
import { SagaStatus } from '../../src/types/saga.types';
import type { SagaState, SagaId } from '../../src/types/saga.types';
import type { SagaEvent } from '../../src/types/events.types';
import { StepStatus } from '../../src/types/saga.types';

function createState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-obs-1' as SagaId,
    sagaType: 'observability-test',
    status: SagaStatus.RUNNING,
    correlationId: 'corr-obs-1',
    steps: [
      { name: 'step-1', status: StepStatus.PENDING, attempt: 0 },
    ],
    currentStepIndex: 0,
    createdAt: 1000,
    updatedAt: 1000,
    metadata: {},
    version: 1,
    ...overrides,
  };
}

function createEvent(overrides?: Partial<SagaEvent>): SagaEvent {
  return {
    id: 'evt-1',
    sagaId: 'saga-obs-1' as SagaId,
    eventType: 'SAGA_STARTED',
    timestamp: 1000,
    ...overrides,
  };
}

// =====================================================================
// ConsoleSagaLogger
// =====================================================================

describe('ConsoleSagaLogger', () => {
  let logger: ConsoleSagaLogger;
  let spyDebug: MockInstance;
  let spyInfo: MockInstance;
  let spyWarn: MockInstance;
  let spyError: MockInstance;

  beforeEach(() => {
    spyDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    spyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger = new ConsoleSagaLogger();
  });

  afterEach(() => {
    spyDebug.mockRestore();
    spyInfo.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  describe('log()', () => {
    it('should call console.debug for debug level', () => {
      logger.log({ timestamp: 1000, level: 'debug', message: 'debug msg', sagaId: 's-1' as SagaId });
      expect(spyDebug).toHaveBeenCalled();
    });

    it('should call console.info for info level', () => {
      logger.log({ timestamp: 1000, level: 'info', message: 'info msg' });
      expect(spyInfo).toHaveBeenCalled();
    });

    it('should call console.warn for warn level', () => {
      logger.log({ timestamp: 1000, level: 'warn', message: 'warn msg' });
      expect(spyWarn).toHaveBeenCalled();
    });

    it('should call console.error for error level', () => {
      logger.log({ timestamp: 1000, level: 'error', message: 'error msg' });
      expect(spyError).toHaveBeenCalled();
    });

    it('should include stepName in the message prefix', () => {
      logger.log({ timestamp: 1000, level: 'info', message: 'done', sagaId: 's-1' as SagaId, stepName: 'step-1' });
      expect(spyInfo).toHaveBeenCalled();
      const callArg = spyInfo.mock.calls[0][0];
      expect(callArg).toContain('[step-1]');
    });
  });

  describe('debug()', () => {
    it('should call log with debug level', () => {
      const logSpy = vi.spyOn(logger, 'log');
      logger.debug('dbg', { key: 'val' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'debug', message: 'dbg', key: 'val' }),
      );
    });
  });

  describe('info()', () => {
    it('should call log with info level', () => {
      const logSpy = vi.spyOn(logger, 'log');
      logger.info('inf');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info', message: 'inf' }),
      );
    });
  });

  describe('warn()', () => {
    it('should call log with warn level', () => {
      const logSpy = vi.spyOn(logger, 'log');
      logger.warn('wrn');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn', message: 'wrn' }),
      );
    });
  });

  describe('error()', () => {
    it('should call log with error level', () => {
      const logSpy = vi.spyOn(logger, 'log');
      logger.error('err');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', message: 'err' }),
      );
    });
  });
});

// =====================================================================
// NoopSagaMetrics
// =====================================================================

describe('NoopSagaMetrics', () => {
  let metrics: NoopSagaMetrics;

  beforeEach(() => {
    metrics = new NoopSagaMetrics();
  });

  it('recordStepDuration should not throw', () => {
    expect(() => metrics.recordStepDuration('step1', 100, 'SUCCEEDED')).not.toThrow();
  });

  it('recordSagaDuration should not throw', () => {
    expect(() => metrics.recordSagaDuration('order-saga', 500, SagaStatus.COMPLETED)).not.toThrow();
  });

  it('incrementActiveSagas should not throw', () => {
    expect(() => metrics.incrementActiveSagas(1)).not.toThrow();
  });

  it('incrementStepCounter should not throw', () => {
    expect(() => metrics.incrementStepCounter('step1', 'SUCCEEDED')).not.toThrow();
  });

  it('incrementCompensationCounter should not throw', () => {
    expect(() => metrics.incrementCompensationCounter('step1', 'FAILED')).not.toThrow();
  });
});

// =====================================================================
// SagaObservability
// =====================================================================

describe('SagaObservability', () => {
  let logger: Mocked<ConsoleSagaLogger>;
  let metrics: Mocked<NoopSagaMetrics>;
  let obs: SagaObservability;

  beforeEach(() => {
    logger = {
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    metrics = {
      recordStepDuration: vi.fn(),
      recordSagaDuration: vi.fn(),
      incrementActiveSagas: vi.fn(),
      incrementStepCounter: vi.fn(),
      incrementCompensationCounter: vi.fn(),
    };
    obs = new SagaObservability(logger, metrics);
  });

  describe('onStepStart', () => {
    it('should log step start with info level', () => {
      const state = createState();
      obs.onStepStart(state, 'step-1');

      expect(logger.info).toHaveBeenCalledWith(
        'Step started',
        expect.objectContaining({
          level: 'info',
          sagaId: state.id,
          stepName: 'step-1',
        }),
      );
    });
  });

  describe('onStepEnd', () => {
    it('should log and record metrics', () => {
      const state = createState();
      obs.onStepEnd(state, 'step-1', 150, 'SUCCEEDED');

      expect(logger.info).toHaveBeenCalledWith(
        'Step completed',
        expect.objectContaining({
          sagaId: state.id,
          stepName: 'step-1',
          status: 'SUCCEEDED',
          durationMs: 150,
        }),
      );
      expect(metrics.recordStepDuration).toHaveBeenCalledWith('step-1', 150, 'SUCCEEDED');
      expect(metrics.incrementStepCounter).toHaveBeenCalledWith('step-1', 'SUCCEEDED');
    });
  });

  describe('onSagaEnd', () => {
    it('should log and record saga duration and decrement active count', () => {
      const state = createState({ status: SagaStatus.COMPLETED, sagaType: 'order-flow' });
      obs.onSagaEnd(state, 2000);

      expect(logger.info).toHaveBeenCalledWith(
        'Saga completed',
        expect.objectContaining({
          sagaId: state.id,
          correlationId: state.correlationId,
          status: SagaStatus.COMPLETED,
          durationMs: 2000,
        }),
      );
      expect(metrics.recordSagaDuration).toHaveBeenCalledWith('order-flow', 2000, SagaStatus.COMPLETED);
      expect(metrics.incrementActiveSagas).toHaveBeenCalledWith(-1);
    });
  });

  describe('onSagaEvent', () => {
    it('should log at debug level', () => {
      const event = createEvent({ sagaId: 's-1' as SagaId });
      obs.onSagaEvent(event);

      expect(logger.debug).toHaveBeenCalledWith(
        'Saga event',
        expect.objectContaining({
          level: 'debug',
          sagaId: 's-1',
          eventType: 'SAGA_STARTED',
        }),
      );
    });
  });

  describe('onError', () => {
    it('should log at error level with cause details', () => {
      const err = new Error('Something went wrong');
      obs.onError('saga-1' as SagaId, 'corr-1', 'Execution failed', err);

      expect(logger.error).toHaveBeenCalledWith(
        'Execution failed',
        expect.objectContaining({
          level: 'error',
          sagaId: 'saga-1',
          correlationId: 'corr-1',
          cause: { message: 'Something went wrong', stack: expect.any(String) },
        }),
      );
    });

    it('should handle non-Error cause gracefully', () => {
      obs.onError('saga-1' as SagaId, 'corr-1', 'fail', 'string error');

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
