import { MemoryStore } from '../../../src/stores';
import { ClockMock } from '../../helpers/clock-mock';

describe('MemoryStore', () => {
  let clock: ClockMock;
  let store: MemoryStore;

  beforeEach(() => {
    clock = new ClockMock(1000);
    store = new MemoryStore(clock);
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return stored state', async () => {
      await store.set('key1', { tokens: 5 });
      const result = await store.get('key1');
      expect(result).toEqual({ tokens: 5 });
    });

    it('should return null for expired TTL', async () => {
      await store.set('key1', { tokens: 5 }, 100);
      clock.advance(200);
      const result = await store.get('key1');
      expect(result).toBeNull();
    });

    it('should return state when TTL not expired', async () => {
      await store.set('key1', { tokens: 5 }, 200);
      clock.advance(100);
      const result = await store.get('key1');
      expect(result).toEqual({ tokens: 5 });
    });

    it('should store with TTL=0 (no expiration)', async () => {
      await store.set('key1', { tokens: 5 }, 0);
      clock.advance(1_000_000);
      const result = await store.get('key1');
      expect(result).toEqual({ tokens: 5 });
    });

    it('should delete expired entry from internal map', async () => {
      await store.set('key1', { tokens: 5 }, 100);
      clock.advance(200);
      await store.get('key1');
      expect(store.size).toBe(0);
    });
  });

  describe('set', () => {
    it('should store state without TTL when not provided', async () => {
      await store.set('key1', { tokens: 5 });
      clock.advance(1_000_000);
      const result = await store.get('key1');
      expect(result).toEqual({ tokens: 5 });
    });

    it('should override existing key', async () => {
      await store.set('key1', { tokens: 5 });
      await store.set('key1', { tokens: 10 });
      const result = await store.get('key1');
      expect(result).toEqual({ tokens: 10 });
    });

    it('should store with TTL', async () => {
      await store.set('key1', { tokens: 5 }, 500);
      const result = await store.get('key1');
      expect(result).toEqual({ tokens: 5 });
    });
  });

  describe('delete', () => {
    it('should remove a key', async () => {
      await store.set('key1', { tokens: 5 });
      await store.delete('key1');
      const result = await store.get('key1');
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(store.delete('nonexistent')).resolves.not.toThrow();
    });

    it('should reduce size', async () => {
      await store.set('key1', { tokens: 5 });
      expect(store.size).toBe(1);
      await store.delete('key1');
      expect(store.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all keys', async () => {
      await store.set('key1', { tokens: 5 });
      await store.set('key2', { tokens: 3 });
      expect(store.size).toBe(2);

      await store.clear();
      expect(store.size).toBe(0);

      const r1 = await store.get('key1');
      const r2 = await store.get('key2');
      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    it('should work on empty store', async () => {
      await expect(store.clear()).resolves.not.toThrow();
      expect(store.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty store', () => {
      expect(store.size).toBe(0);
    });

    it('should return correct count', async () => {
      await store.set('a', {});
      await store.set('b', {});
      expect(store.size).toBe(2);
    });
  });
});
