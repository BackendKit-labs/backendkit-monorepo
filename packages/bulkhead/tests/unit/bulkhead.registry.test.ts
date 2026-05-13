import { describe, it, expect, beforeEach } from 'vitest';
import { BulkheadRegistry } from '../../src/bulkhead/bulkhead.registry.js';

describe('BulkheadRegistry', () => {
  let registry: BulkheadRegistry;

  beforeEach(() => {
    registry = new BulkheadRegistry();
  });

  it('creates a new bulkhead with getOrCreate', () => {
    const bh = registry.getOrCreate({ name: 'test' });
    expect(bh).toBeDefined();
    expect(bh.getMetrics().name).toBe('test');
  });

  it('returns the same instance for the same name', () => {
    const bh1 = registry.getOrCreate({ name: 'same' });
    const bh2 = registry.getOrCreate({ name: 'same' });
    expect(bh1).toBe(bh2);
  });

  it('getForClient creates a per-client bulkhead', () => {
    const bh = registry.getForClient('client-1');
    expect(bh.getMetrics().name).toBe('client:client-1');
    expect(bh.getMetrics().maxConcurrentCalls).toBe(5);
  });

  it('getForClient with endpoint includes it in the name', () => {
    const bh = registry.getForClient('client-1', '/api/data');
    expect(bh.getMetrics().name).toBe('client:client-1:/api/data');
  });

  it('getForService creates a service-level bulkhead', () => {
    const bh = registry.getForService('auth');
    expect(bh.getMetrics().name).toBe('service:auth');
    expect(bh.getMetrics().maxConcurrentCalls).toBe(20);
  });

  it('getForDatabase creates a database bulkhead', () => {
    const bh = registry.getForDatabase('public');
    expect(bh.getMetrics().name).toBe('database:public');
    expect(bh.getMetrics().maxConcurrentCalls).toBe(15);
  });

  it('getForHttpExternal creates an external HTTP bulkhead', () => {
    const bh = registry.getForHttpExternal('payments');
    expect(bh.getMetrics().name).toBe('http:payments');
    expect(bh.getMetrics().maxConcurrentCalls).toBe(8);
  });

  it('getAllMetrics returns all registered bulkheads', () => {
    registry.getForClient('c1');
    registry.getForService('svc1');
    const all = registry.getAllMetrics();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['client:c1']).toBeDefined();
    expect(all['service:svc1']).toBeDefined();
  });

  it('getOverloadedBulkheads returns none when not overloaded', () => {
    registry.getForService('svc');
    expect(registry.getOverloadedBulkheads()).toHaveLength(0);
  });

  it('resetAllMetrics clears counters across all bulkheads', async () => {
    const bh = registry.getOrCreate({ name: 'measured' });
    await bh.execute(async () => 'ok');
    expect(bh.getMetrics().totalCalls).toBe(1);

    registry.resetAllMetrics();
    expect(bh.getMetrics().totalCalls).toBe(0);
  });

  it('getOrCreate respects custom config options', () => {
    const bh = registry.getOrCreate({ name: 'custom', maxConcurrentCalls: 42 });
    expect(bh.getMetrics().maxConcurrentCalls).toBe(42);
  });
});
