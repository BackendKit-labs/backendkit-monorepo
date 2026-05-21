// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/saga.service.test.ts
//
// Integration tests for SagaOrchestrator (NestJS service).
// Mocks SagaEngine to verify delegation.
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import { ok } from '@backendkit-labs/result';
import { SagaOrchestrator } from '../../src/nestjs/saga.service';
import { SagaEngine } from '../../src/core/saga-engine';
import { SagaBuilder } from '../../src/core/saga-builder';


// Mock SagaEngine constructor -- the constructor returns a mock instance
const mockEngineInstance = {
  define: vi.fn(),
  run: vi.fn(),
  getStatus: vi.fn(),
  list: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

vi.mock('../../src/core/saga-engine', () => ({
  SagaEngine: vi.fn(() => mockEngineInstance),
}));

describe('SagaOrchestrator', () => {
  let orchestrator: SagaOrchestrator;
  const mockStores = {
    sagaStore: { save: vi.fn(), load: vi.fn(), list: vi.fn(), delete: vi.fn() },
    lockProvider: { acquire: vi.fn(), release: vi.fn(), isLocked: vi.fn() },
    eventBus: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), subscribeAll: vi.fn() },
  };

  const options = { stores: mockStores };

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SagaOrchestrator(options as any);
  });

  it('should create SagaEngine with stores on construction', () => {
    expect(vi.mocked(SagaEngine)).toHaveBeenCalledWith(
      mockStores.sagaStore,
      mockStores.lockProvider,
      mockStores.eventBus,
    );
  });

  describe('define()', () => {
    it('should register a saga definition and return it', () => {
      const builder = SagaBuilder.define('test');
      const expectedDef = { name: 'test', steps: [] };
      mockEngineInstance.define.mockReturnValue(expectedDef);

      const result = orchestrator.define(builder);

      expect(mockEngineInstance.define).toHaveBeenCalledWith(builder);
      expect(result).toBe(expectedDef);
    });
  });

  describe('run()', () => {
    it('should delegate to engine.run()', async () => {
      const expected = ok({ sagaId: 's-1', status: 'COMPLETED', timeline: [] } as any);
      mockEngineInstance.run.mockResolvedValue(expected);

      const result = await orchestrator.run('order-saga', { id: 1 });

      expect(mockEngineInstance.run).toHaveBeenCalledWith('order-saga', { id: 1 });
      expect(result).toBe(expected);
    });
  });

  describe('getStatus()', () => {
    it('should delegate to engine.getStatus()', async () => {
      const sagaId = 'saga-1' as any;
      const expected = ok({ id: sagaId });
      mockEngineInstance.getStatus.mockResolvedValue(expected);

      const result = await orchestrator.getStatus(sagaId);

      expect(mockEngineInstance.getStatus).toHaveBeenCalledWith(sagaId);
      expect(result).toBe(expected);
    });
  });

  describe('list()', () => {
    it('should delegate to engine.list()', async () => {
      const expected = ok([]);
      mockEngineInstance.list.mockResolvedValue(expected);

      const result = await orchestrator.list();

      expect(mockEngineInstance.list).toHaveBeenCalledWith(undefined);
      expect(result).toBe(expected);
    });

    it('should pass filter to engine.list()', async () => {
      const filter = { status: 'RUNNING' as any };
      mockEngineInstance.list.mockResolvedValue(ok([]));

      await orchestrator.list(filter);

      expect(mockEngineInstance.list).toHaveBeenCalledWith(filter);
    });
  });

  describe('pause()', () => {
    it('should delegate to engine.pause()', async () => {
      const sagaId = 'saga-1' as any;
      const expected = ok(undefined);
      mockEngineInstance.pause.mockResolvedValue(expected);

      const result = await orchestrator.pause(sagaId);

      expect(mockEngineInstance.pause).toHaveBeenCalledWith(sagaId);
      expect(result).toBe(expected);
    });
  });

  describe('resume()', () => {
    it('should delegate to engine.resume()', async () => {
      const sagaId = 'saga-1' as any;
      const expected = ok({ sagaId, status: 'COMPLETED', timeline: [] } as any);
      mockEngineInstance.resume.mockResolvedValue(expected);

      const result = await orchestrator.resume(sagaId);

      expect(mockEngineInstance.resume).toHaveBeenCalledWith(sagaId);
      expect(result).toBe(expected);
    });
  });

  describe('on()', () => {
    it('should subscribe to eventBus and return unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = vi.fn();
      mockStores.eventBus.subscribe.mockReturnValue(unsubscribe);

      const result = orchestrator.on('SAGA_STARTED', handler);

      expect(mockStores.eventBus.subscribe).toHaveBeenCalledWith('SAGA_STARTED', handler);
      expect(result).toBe(unsubscribe);
    });
  });

  describe('onAll()', () => {
    it('should subscribeAll on eventBus and return unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = vi.fn();
      mockStores.eventBus.subscribeAll.mockReturnValue(unsubscribe);

      const result = orchestrator.onAll(handler);

      expect(mockStores.eventBus.subscribeAll).toHaveBeenCalledWith(handler);
      expect(result).toBe(unsubscribe);
    });
  });

  describe('getEngine()', () => {
    it('should return the underlying SagaEngine instance', () => {
      const engine = orchestrator.getEngine();
      expect(engine).toBe(mockEngineInstance);
    });
  });
});
