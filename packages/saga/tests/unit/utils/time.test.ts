import { currentTimestamp, createTimer } from '../../../src/utils/time';

describe('time', () => {
  describe('currentTimestamp', () => {
    it('should return a number', () => {
      const ts = currentTimestamp();
      expect(typeof ts).toBe('number');
    });

    it('should return current time in milliseconds', () => {
      const before = Date.now();
      const ts = currentTimestamp();
      const after = Date.now();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('should return increasing values', () => {
      const ts1 = currentTimestamp();
      const ts2 = currentTimestamp();
      expect(ts2).toBeGreaterThanOrEqual(ts1);
    });
  });

  describe('createTimer', () => {
    it('should create a timer with promise and cancel function', () => {
      const timer = createTimer(1000);
      expect(timer).toHaveProperty('promise');
      expect(timer).toHaveProperty('cancel');
      expect(typeof timer.cancel).toBe('function');
      expect(timer.promise).toBeInstanceOf(Promise);
      // Prevent unhandled rejection
      timer.promise.catch(() => {});
      timer.cancel();
    });

    it('should reject the promise when timer fires', async () => {
      const timer = createTimer(10);
      await expect(timer.promise).rejects.toThrow('Timer timed out');
    });

    it('should reject when cancelled', async () => {
      const timer = createTimer(5000);
      const promise = timer.promise;
      timer.cancel();
      await expect(promise).rejects.toThrow('Timer cancelled');
    });

    it('should clean up timeout on cancel', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const timer = createTimer(5000);
      // Suppress unhandled rejection
      timer.promise.catch(() => {});
      timer.cancel();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should be safe to cancel a timer that already fired', async () => {
      const timer = createTimer(5);
      // Wait for it to fire
      await expect(timer.promise).rejects.toThrow('Timer timed out');
      // Cancel after it already fired â€” should not throw
      expect(() => timer.cancel()).not.toThrow();
    });

    it('should allow cancel multiple times without error', () => {
      const timer = createTimer(1000);
      // Suppress unhandled rejection
      timer.promise.catch(() => {});
      timer.cancel();
      expect(() => timer.cancel()).not.toThrow();
    });
  });
});
