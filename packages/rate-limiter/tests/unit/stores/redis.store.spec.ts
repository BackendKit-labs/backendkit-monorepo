import { supportsAtomicConsume } from '../../../src/stores';
import { MemoryStore } from '../../../src/stores/memory.store';
import { IRateLimiterStore } from '../../../src/interfaces/store.interface';

describe('RedisStore helpers', () => {
  describe('supportsAtomicConsume', () => {
    it('should return true for an object with atomicConsume method', () => {
      const store: IRateLimiterStore = {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        clear: async () => {},
        atomicConsume: async () => ({ allowed: true, remaining: 0, resetAt: 0, totalLimit: 0 }),
      } as IRateLimiterStore;
      expect(supportsAtomicConsume(store)).toBe(true);
    });

    it('should return false for MemoryStore', () => {
      const store = new MemoryStore();
      expect(supportsAtomicConsume(store)).toBe(false);
    });

    it('should return false for a plain store without atomicConsume', () => {
      const plainStore: IRateLimiterStore = {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        clear: async () => {},
      };
      expect(supportsAtomicConsume(plainStore)).toBe(false);
    });
  });
});
