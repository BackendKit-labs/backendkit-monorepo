/**
 * Integration tests: auto-learning + circuit-breaker + bulkhead
 *
 * No mocks. Real instances wired manually — exactly as AutoLearningAdaptersService
 * does it internally. These tests verify the full flow:
 *
 *   record patterns → runOnce() → anomaly detection → config tuning
 *     → onConfigChange fires → circuit breaker / bulkhead updated
 *
 * Expected values are derived from default configs:
 *   - minSamplesBeforeTuning: 10   (need ≥10 patterns per cycle)
 *   - smoothingFactor: 0.3
 *   - adjustmentStepMs: 500
 *   - errorRateThreshold: 0.05
 *   - latencyStdDevThreshold: 2.5
 */
import { describe, it, expect, vi } from 'vitest';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import { AutoLearningCore } from '../../src/core/auto-learning-core.js';
import type { EndpointPattern, TunableConfig } from '../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENDPOINT = { method: 'GET', path: '/api/payments' };

function makeCore() {
  return AutoLearningCore.create();
}

function record(
  core: AutoLearningCore,
  count: number,
  overrides: Partial<EndpointPattern> = {},
) {
  for (let i = 0; i < count; i++) {
    core.recordPattern({
      ...ENDPOINT,
      statusCode: 200,
      durationMs: 100,
      timestamp: new Date(),
      ...overrides,
    });
  }
}

/** Mirrors the logic inside AutoLearningAdaptersService */
function wireCB(core: AutoLearningCore, cbRegistry: CircuitBreakerRegistry) {
  core.onConfigChange((config) => {
    for (const name of Object.keys(cbRegistry.getAllMetrics())) {
      cbRegistry.getOrCreate({ name }).updateConfig({
        failureThreshold: config.circuitBreaker.failureThreshold,
        openTimeoutMs: config.circuitBreaker.openTimeoutMs,
      });
    }
  });
}

function wireBH(core: AutoLearningCore, bhRegistry: BulkheadRegistry) {
  core.onConfigChange((config) => {
    for (const name of Object.keys(bhRegistry.getAllMetrics())) {
      bhRegistry.getOrCreate({ name }).updateConfig({
        maxConcurrentCalls: config.bulkhead.maxConcurrentCalls,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

describe('integration: Circuit Breaker', () => {
  it('decreases failureThreshold when high error-rate anomalies are detected', async () => {
    // 12 successes + 3 errors → errorRate=0.2, errorCount=3
    // Anomaly detector: 1.0 > 0.2*2(0.4) ✓ and 1.0 > 0.05 ✓ → 3 HIGH anomalies
    // ConfigTuner: failureThreshold = max(50 - 10*3, 10) = 20
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const cb = cbRegistry.getOrCreate({ name: 'api:payments' });
    const spy = vi.spyOn(cb, 'updateConfig');

    wireCB(core, cbRegistry);
    record(core, 12);
    record(core, 3, { statusCode: 500 });

    const result = await core.runOnce();

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ failureThreshold: 20 }),
    );
  });

  it('increases failureThreshold when no anomalies are detected', async () => {
    // 15 healthy patterns → 0 anomalies → failureThreshold = min(50+5, 80) = 55
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const cb = cbRegistry.getOrCreate({ name: 'api:payments' });
    const spy = vi.spyOn(cb, 'updateConfig');

    wireCB(core, cbRegistry);
    record(core, 15);

    await core.runOnce();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ failureThreshold: 55 }),
    );
  });

  it('passes openTimeoutMs unchanged when it has not been tuned', async () => {
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const cb = cbRegistry.getOrCreate({ name: 'api:payments' });
    const spy = vi.spyOn(cb, 'updateConfig');

    wireCB(core, cbRegistry);
    record(core, 15);

    await core.runOnce();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ openTimeoutMs: 30000 }),
    );
  });

  it('updates ALL circuit breakers registered in the registry', async () => {
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const cb1 = cbRegistry.getOrCreate({ name: 'api:payments' });
    const cb2 = cbRegistry.getOrCreate({ name: 'api:orders' });
    const spy1 = vi.spyOn(cb1, 'updateConfig');
    const spy2 = vi.spyOn(cb2, 'updateConfig');

    wireCB(core, cbRegistry);
    record(core, 15);

    await core.runOnce();

    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });

  it('does not call updateConfig when registry has no instances', async () => {
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry(); // empty — no getOrCreate called
    let updateConfigCalled = false;

    core.onConfigChange(() => {
      if (Object.keys(cbRegistry.getAllMetrics()).length > 0) {
        updateConfigCalled = true;
      }
    });

    record(core, 15);
    const result = await core.runOnce();

    expect(result.ok).toBe(true);
    expect(updateConfigCalled).toBe(false);
  });

  it('skips tuning when patterns are below minSamplesBeforeTuning', async () => {
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const cb = cbRegistry.getOrCreate({ name: 'api:payments' });
    const spy = vi.spyOn(cb, 'updateConfig');

    wireCB(core, cbRegistry);
    record(core, 5); // 5 < minSamplesBeforeTuning(10)

    await core.runOnce();

    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// httpClient config tuning
// ---------------------------------------------------------------------------

describe('integration: httpClient config tuning', () => {
  it('increases timeoutMs when p95 latency is consistently high', async () => {
    // All at 6000ms → p95=6000 → target=min(12000,30000)=12000
    // smoothed = 10000 + (12000-10000)*0.3 = 10600
    const core = makeCore();
    const captured: TunableConfig[] = [];
    core.onConfigChange((config) => captured.push(config));

    record(core, 15, { durationMs: 6000 });

    await core.runOnce();

    expect(captured).toHaveLength(1);
    expect(captured[0]!.httpClient.timeoutMs).toBe(10600);
  });

  it('decreases timeoutMs when p95 latency is very low', async () => {
    // All at 100ms → p95=100 → target=max(200,1000)=1000
    // smoothed = 10000 + (1000-10000)*0.3 = 7300
    const core = makeCore();
    const captured: TunableConfig[] = [];
    core.onConfigChange((config) => captured.push(config));

    record(core, 15);

    await core.runOnce();

    expect(captured).toHaveLength(1);
    expect(captured[0]!.httpClient.timeoutMs).toBe(7300);
  });

  it('increases maxRetries when error rate exceeds 10%', async () => {
    // 2 errors / 15 total = 13.3% > 10% → maxRetries: 3→4
    // errorCount=2 < 3, so no anomaly is triggered (only avgErrorRate matters here)
    const core = makeCore();
    const captured: TunableConfig[] = [];
    core.onConfigChange((config) => captured.push(config));

    record(core, 13);
    record(core, 2, { statusCode: 500 });

    await core.runOnce();

    expect(captured).toHaveLength(1);
    expect(captured[0]!.httpClient.maxRetries).toBe(4);
  });

  it('decreases maxRetries when error rate is below 1%', async () => {
    // 15 healthy patterns → errorRate=0 < 1% → maxRetries: 3→2
    const core = makeCore();
    const captured: TunableConfig[] = [];
    core.onConfigChange((config) => captured.push(config));

    record(core, 15);

    await core.runOnce();

    expect(captured).toHaveLength(1);
    expect(captured[0]!.httpClient.maxRetries).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Bulkhead
// ---------------------------------------------------------------------------

describe('integration: Bulkhead', () => {
  it('calls updateConfig on bulkhead instances when config changes', async () => {
    const core = makeCore();
    const bhRegistry = new BulkheadRegistry();
    const bh = bhRegistry.getOrCreate({ name: 'api:payments' });
    const spy = vi.spyOn(bh, 'updateConfig');

    wireBH(core, bhRegistry);
    record(core, 15);

    await core.runOnce();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ maxConcurrentCalls: 10 }), // default unchanged
    );
  });

  it('updates ALL bulkheads registered in the registry', async () => {
    const core = makeCore();
    const bhRegistry = new BulkheadRegistry();
    const bh1 = bhRegistry.getOrCreate({ name: 'service:payments' });
    const bh2 = bhRegistry.getOrCreate({ name: 'service:orders' });
    const bh3 = bhRegistry.getOrCreate({ name: 'service:inventory' });
    const spy1 = vi.spyOn(bh1, 'updateConfig');
    const spy2 = vi.spyOn(bh2, 'updateConfig');
    const spy3 = vi.spyOn(bh3, 'updateConfig');

    wireBH(core, bhRegistry);
    record(core, 15);

    await core.runOnce();

    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
    expect(spy3).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CB + BH together
// ---------------------------------------------------------------------------

describe('integration: CircuitBreaker + Bulkhead together', () => {
  it('updates both registries in a single feedback cycle', async () => {
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const bhRegistry = new BulkheadRegistry();
    const cb = cbRegistry.getOrCreate({ name: 'api:payments' });
    const bh = bhRegistry.getOrCreate({ name: 'api:payments' });
    const cbSpy = vi.spyOn(cb, 'updateConfig');
    const bhSpy = vi.spyOn(bh, 'updateConfig');

    wireCB(core, cbRegistry);
    wireBH(core, bhRegistry);
    record(core, 15);

    const result = await core.runOnce();

    expect(result.ok).toBe(true);
    expect(cbSpy).toHaveBeenCalled();
    expect(bhSpy).toHaveBeenCalled();
  });

  it('still updates BH when CB registry is empty', async () => {
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry(); // no instances
    const bhRegistry = new BulkheadRegistry();
    const bh = bhRegistry.getOrCreate({ name: 'api:payments' });
    const bhSpy = vi.spyOn(bh, 'updateConfig');

    wireCB(core, cbRegistry);
    wireBH(core, bhRegistry);
    record(core, 15);

    const result = await core.runOnce();

    expect(result.ok).toBe(true);
    expect(bhSpy).toHaveBeenCalled();
  });

  it('anomaly scenario: CB tightens while BH keeps default concurrency', async () => {
    // 3 high anomalies → failureThreshold drops to 20
    // bulkheadMaxConcurrent unchanged at 10
    const core = makeCore();
    const cbRegistry = new CircuitBreakerRegistry();
    const bhRegistry = new BulkheadRegistry();
    const cb = cbRegistry.getOrCreate({ name: 'api:payments' });
    const bh = bhRegistry.getOrCreate({ name: 'api:payments' });
    const cbSpy = vi.spyOn(cb, 'updateConfig');
    const bhSpy = vi.spyOn(bh, 'updateConfig');

    wireCB(core, cbRegistry);
    wireBH(core, bhRegistry);
    record(core, 12);
    record(core, 3, { statusCode: 500 });

    await core.runOnce();

    expect(cbSpy).toHaveBeenCalledWith(
      expect.objectContaining({ failureThreshold: 20 }),
    );
    expect(bhSpy).toHaveBeenCalledWith(
      expect.objectContaining({ maxConcurrentCalls: 10 }),
    );
  });
});
