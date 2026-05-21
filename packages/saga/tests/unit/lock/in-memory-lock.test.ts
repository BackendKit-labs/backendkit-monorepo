import { isOk } from '@backendkit-labs/result';
import { InMemoryLock } from '../../../src/lock/in-memory-lock';

describe('InMemoryLock', () => {
  let lock: InMemoryLock;

  beforeEach(() => {
    lock = new InMemoryLock();
  });

  describe('acquire', () => {
    it('should return true when acquiring a new lock', async () => {
      const result = await lock.acquire('lock-key-1', 5000);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false when lock is already held', async () => {
      await lock.acquire('lock-key-1', 5000);

      const result = await lock.acquire('lock-key-1', 5000);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }
    });

    it('should allow acquiring different lock keys independently', async () => {
      await lock.acquire('lock-a', 5000);

      const result = await lock.acquire('lock-b', 5000);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    it('should return true for expired lock (TTL passed)', async () => {
      await lock.acquire('lock-key-1', 1); // 1ms TTL

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10));

      const result = await lock.acquire('lock-key-1', 5000);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('release', () => {
    it('should release an acquired lock', async () => {
      await lock.acquire('lock-key-1', 5000);

      const releaseResult = await lock.release('lock-key-1');
      expect(isOk(releaseResult)).toBe(true);

      // Now should be able to acquire again
      const reacquireResult = await lock.acquire('lock-key-1', 5000);
      expect(isOk(reacquireResult)).toBe(true);
      if (isOk(reacquireResult)) {
        expect(reacquireResult.value).toBe(true);
      }
    });

    it('should not throw when releasing a non-existent lock', async () => {
      const result = await lock.release('non-existent');
      expect(isOk(result)).toBe(true);
    });
  });

  describe('isLocked', () => {
    it('should return false for non-existent lock', async () => {
      const result = await lock.isLocked('non-existent');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }
    });

    it('should return true for an active lock', async () => {
      await lock.acquire('lock-key-1', 5000);

      const result = await lock.isLocked('lock-key-1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false for an expired lock and clean it up', async () => {
      await lock.acquire('lock-key-1', 1); // 1ms TTL

      await new Promise((r) => setTimeout(r, 10));

      const result = await lock.isLocked('lock-key-1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }

      // After isLocked cleanup, should be able to acquire
      const acquireResult = await lock.acquire('lock-key-1', 5000);
      expect(isOk(acquireResult)).toBe(true);
      if (isOk(acquireResult)) {
        expect(acquireResult.value).toBe(true);
      }
    });

    it('should handle expired lock detection edge case (same timestamp)', async () => {
      // Acquire with very short TTL
      await lock.acquire('lock-key-1', 0);
      // 0ms TTL means already expired
      const result = await lock.isLocked('lock-key-1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }
    });
  });
});
