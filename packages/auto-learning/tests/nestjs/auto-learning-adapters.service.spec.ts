import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import { AutoLearningAdaptersService } from '../../src/nestjs/auto-learning-adapters.service.js';
import { NoopObservabilityAdapter } from '../../src/core/observability/index.js';
import type { AutoLearningCore } from '../../src/core/auto-learning-core.js';
import type { TunableConfig } from '../../src/core/types.js';
import type { AutoLearningModuleOptions } from '../../src/nestjs/auto-learning.module.js';
import type { ModuleRef } from '@nestjs/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG: TunableConfig = {
  timeoutMs: 5000,
  maxRetries: 3,
  circuitBreakerThreshold: 0.4,
  circuitBreakerHalfOpenAfterMs: 20000,
  bulkheadMaxConcurrent: 8,
};

function makeMockCore() {
  const listeners: Array<(config: TunableConfig) => void> = [];
  const observability = new NoopObservabilityAdapter();
  vi.spyOn(observability, 'info');
  vi.spyOn(observability, 'warn');
  vi.spyOn(observability, 'debug');

  return {
    onConfigChange: vi.fn((cb: (config: TunableConfig) => void) => {
      listeners.push(cb);
    }),
    observability,
    _fire: (config: TunableConfig) => listeners.forEach((cb) => cb(config)),
  };
}

function makeCBRegistryMock() {
  const cbInstance = { updateConfig: vi.fn() };
  const registry = {
    getAllMetrics: vi.fn(() => ({ 'http:payments': {}, 'service:auth': {} })),
    getOrCreate: vi.fn(() => cbInstance),
  } as unknown as CircuitBreakerRegistry;
  return { registry, cbInstance };
}

function makeBHRegistryMock() {
  const bhInstance = { updateConfig: vi.fn() };
  const registry = {
    getAllMetrics: vi.fn(() => ({ 'service:api': {} })),
    getOrCreate: vi.fn(() => bhInstance),
  } as unknown as BulkheadRegistry;
  return { registry, bhInstance };
}

function makeModuleRef(opts: {
  cb?: CircuitBreakerRegistry;
  bh?: BulkheadRegistry;
} = {}) {
  return {
    get: vi.fn((token: unknown) => {
      if (token === CircuitBreakerRegistry && opts.cb) return opts.cb;
      if (token === BulkheadRegistry && opts.bh) return opts.bh;
      throw new Error(`Provider not registered: ${(token as any)?.name ?? token}`);
    }),
  } as unknown as ModuleRef;
}

function makeService(
  options: AutoLearningModuleOptions,
  core: ReturnType<typeof makeMockCore>,
  moduleRef: ModuleRef,
) {
  return new AutoLearningAdaptersService(
    core as unknown as AutoLearningCore,
    options,
    moduleRef,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoLearningAdaptersService', () => {
  let core: ReturnType<typeof makeMockCore>;

  beforeEach(() => {
    core = makeMockCore();
  });

  // ---- no adapters configured ----

  describe('when no adapters are configured', () => {
    it('should not wire onConfigChange', async () => {
      const service = makeService({}, core, makeModuleRef());

      await service.onModuleInit();

      expect(core.onConfigChange).not.toHaveBeenCalled();
    });

    it('should not wire onConfigChange when adapters object is empty', async () => {
      const service = makeService({ adapters: {} }, core, makeModuleRef());

      await service.onModuleInit();

      expect(core.onConfigChange).not.toHaveBeenCalled();
    });
  });

  // ---- circuit breaker adapter ----

  describe('circuit breaker adapter', () => {
    it('should connect when CircuitBreakerModule is registered', async () => {
      const { registry } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();

      expect(core.observability.info).toHaveBeenCalledWith(
        'CircuitBreakerRegistry adapter connected',
      );
      expect(core.onConfigChange).toHaveBeenCalledTimes(1);
    });

    it('should warn and skip when CircuitBreakerModule is not registered', async () => {
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef(), // no cb
      );

      await service.onModuleInit();

      expect(core.observability.warn).toHaveBeenCalledWith(
        expect.stringContaining('CircuitBreakerModule is not imported'),
      );
      expect(core.onConfigChange).not.toHaveBeenCalled();
    });

    it('should call updateConfig on all registered circuit breakers when config changes', async () => {
      const { registry, cbInstance } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();
      core._fire(BASE_CONFIG);

      // getAllMetrics returns 2 entries → getOrCreate called twice → updateConfig twice
      expect(registry.getOrCreate).toHaveBeenCalledTimes(2);
      expect(cbInstance.updateConfig).toHaveBeenCalledTimes(2);
    });

    it('should map circuitBreakerThreshold (0–1) to failureThreshold (0–100)', async () => {
      const { registry, cbInstance } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();
      core._fire({ ...BASE_CONFIG, circuitBreakerThreshold: 0.4 });

      expect(cbInstance.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ failureThreshold: 40 }),
      );
    });

    it('should map circuitBreakerHalfOpenAfterMs to openTimeoutMs', async () => {
      const { registry, cbInstance } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();
      core._fire({ ...BASE_CONFIG, circuitBreakerHalfOpenAfterMs: 20000 });

      expect(cbInstance.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ openTimeoutMs: 20000 }),
      );
    });

    it('should round fractional threshold values', async () => {
      const { registry, cbInstance } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();
      core._fire({ ...BASE_CONFIG, circuitBreakerThreshold: 0.456 });

      expect(cbInstance.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ failureThreshold: 46 }), // Math.round(45.6)
      );
    });

    it('should emit debug log after updating circuit breakers', async () => {
      const { registry } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();
      core._fire(BASE_CONFIG);

      expect(core.observability.debug).toHaveBeenCalledWith(
        'Circuit breaker config updated',
        expect.objectContaining({ affected: 2 }),
      );
    });
  });

  // ---- bulkhead adapter ----

  describe('bulkhead adapter', () => {
    it('should connect when BulkheadModule is registered', async () => {
      const { registry } = makeBHRegistryMock();
      const service = makeService(
        { adapters: { bulkhead: true } },
        core,
        makeModuleRef({ bh: registry }),
      );

      await service.onModuleInit();

      expect(core.observability.info).toHaveBeenCalledWith(
        'BulkheadRegistry adapter connected',
      );
      expect(core.onConfigChange).toHaveBeenCalledTimes(1);
    });

    it('should warn and skip when BulkheadModule is not registered', async () => {
      const service = makeService(
        { adapters: { bulkhead: true } },
        core,
        makeModuleRef(), // no bh
      );

      await service.onModuleInit();

      expect(core.observability.warn).toHaveBeenCalledWith(
        expect.stringContaining('BulkheadModule is not imported'),
      );
      expect(core.onConfigChange).not.toHaveBeenCalled();
    });

    it('should map bulkheadMaxConcurrent to maxConcurrentCalls', async () => {
      const { registry, bhInstance } = makeBHRegistryMock();
      const service = makeService(
        { adapters: { bulkhead: true } },
        core,
        makeModuleRef({ bh: registry }),
      );

      await service.onModuleInit();
      core._fire({ ...BASE_CONFIG, bulkheadMaxConcurrent: 8 });

      expect(bhInstance.updateConfig).toHaveBeenCalledWith({ maxConcurrentCalls: 8 });
    });

    it('should call updateConfig on all registered bulkheads when config changes', async () => {
      const { registry, bhInstance } = makeBHRegistryMock();
      // Override to return 3 bulkheads
      (registry.getAllMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        'service:api': {},
        'service:db': {},
        'service:cache': {},
      });

      const service = makeService(
        { adapters: { bulkhead: true } },
        core,
        makeModuleRef({ bh: registry }),
      );

      await service.onModuleInit();
      core._fire(BASE_CONFIG);

      expect(bhInstance.updateConfig).toHaveBeenCalledTimes(3);
    });

    it('should emit debug log after updating bulkheads', async () => {
      const { registry } = makeBHRegistryMock();
      const service = makeService(
        { adapters: { bulkhead: true } },
        core,
        makeModuleRef({ bh: registry }),
      );

      await service.onModuleInit();
      core._fire(BASE_CONFIG);

      expect(core.observability.debug).toHaveBeenCalledWith(
        'Bulkhead config updated',
        expect.objectContaining({ affected: 1 }),
      );
    });
  });

  // ---- both adapters ----

  describe('when both adapters are configured', () => {
    it('should connect both and wire a single onConfigChange', async () => {
      const { registry: cbReg } = makeCBRegistryMock();
      const { registry: bhReg } = makeBHRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true, bulkhead: true } },
        core,
        makeModuleRef({ cb: cbReg, bh: bhReg }),
      );

      await service.onModuleInit();

      expect(core.observability.info).toHaveBeenCalledWith('CircuitBreakerRegistry adapter connected');
      expect(core.observability.info).toHaveBeenCalledWith('BulkheadRegistry adapter connected');
      // Only one onConfigChange registered even though both adapters are active
      expect(core.onConfigChange).toHaveBeenCalledTimes(1);
    });

    it('should update both registries on a single config change event', async () => {
      const { registry: cbReg, cbInstance } = makeCBRegistryMock();
      const { registry: bhReg, bhInstance } = makeBHRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true, bulkhead: true } },
        core,
        makeModuleRef({ cb: cbReg, bh: bhReg }),
      );

      await service.onModuleInit();
      core._fire(BASE_CONFIG);

      expect(cbInstance.updateConfig).toHaveBeenCalled();
      expect(bhInstance.updateConfig).toHaveBeenCalled();
    });

    it('should still apply bulkhead when only circuit breaker registry is missing', async () => {
      const { registry: bhReg, bhInstance } = makeBHRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true, bulkhead: true } },
        core,
        makeModuleRef({ bh: bhReg }), // no cb registry
      );

      await service.onModuleInit();
      core._fire(BASE_CONFIG);

      expect(core.observability.warn).toHaveBeenCalledWith(
        expect.stringContaining('CircuitBreakerModule is not imported'),
      );
      expect(bhInstance.updateConfig).toHaveBeenCalled();
    });
  });

  // ---- multiple config changes ----

  describe('on repeated config changes', () => {
    it('should apply each change independently', async () => {
      const { registry, cbInstance } = makeCBRegistryMock();
      const service = makeService(
        { adapters: { circuitBreaker: true } },
        core,
        makeModuleRef({ cb: registry }),
      );

      await service.onModuleInit();

      core._fire({ ...BASE_CONFIG, circuitBreakerThreshold: 0.3 });
      core._fire({ ...BASE_CONFIG, circuitBreakerThreshold: 0.6 });

      expect(cbInstance.updateConfig).toHaveBeenNthCalledWith(
        2, // first call on first CB from first fire
        expect.objectContaining({ failureThreshold: 30 }),
      );
      expect(cbInstance.updateConfig).toHaveBeenNthCalledWith(
        4, // second CB (second fire, second CB name)
        expect.objectContaining({ failureThreshold: 60 }),
      );
    });
  });
});
