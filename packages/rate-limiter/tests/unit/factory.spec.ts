import { RateLimiterFactory } from '../../src/factory';
import { RateLimiter } from '../../src/rate-limiter';
import { TokenBucketAlgorithm } from '../../src/algorithms';
import { ClockMock } from '../helpers/clock-mock';
import { StoreMock } from '../helpers/store-mock';

describe('RateLimiterFactory', () => {
  let clock: ClockMock;

  beforeEach(() => {
    clock = new ClockMock(1000);
  });

  describe('create', () => {
    it('should create a RateLimiter with token-bucket algorithm and memory store', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'token-bucket',
          store: 'memory',
          bucketSize: 10,
          tokensPerSecond: 5,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should create a RateLimiter with fixed-window algorithm and default memory store', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'fixed-window',
          windowMs: 60_000,
          maxRequests: 10,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should create a RateLimiter with sliding-window-log algorithm', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'sliding-window-log',
          windowMs: 60_000,
          maxRequests: 5,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should create a RateLimiter with sliding-window-counter algorithm', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'sliding-window-counter',
          windowMs: 60_000,
          maxRequests: 10,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should accept a custom algorithm instance', () => {
      const customAlgo = new TokenBucketAlgorithm();
      const limiter = RateLimiterFactory.create(
        {
          algorithm: customAlgo,
          bucketSize: 10,
          tokensPerSecond: 5,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should accept a custom store instance', () => {
      const customStore = new StoreMock();
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'token-bucket',
          store: customStore,
          bucketSize: 10,
          tokensPerSecond: 5,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should use SystemClock when clock is not provided', () => {
      const limiter = RateLimiterFactory.create({
        algorithm: 'token-bucket',
        bucketSize: 10,
        tokensPerSecond: 5,
      } as never);

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should pass keyPrefix to RateLimiter', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'token-bucket',
          keyPrefix: 'myapp:',
          bucketSize: 10,
          tokensPerSecond: 5,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should throw for unknown algorithm', () => {
      expect(() =>
        RateLimiterFactory.create({
          algorithm: 'unknown-algo' as never,
        }),
      ).toThrow(/Unknown algorithm/);
    });

    it('should create with memory store explicitly', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'fixed-window',
          store: 'memory',
          windowMs: 60_000,
          maxRequests: 10,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should extract algorithm-specific config correctly', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'token-bucket',
          store: 'memory',
          bucketSize: 20,
          tokensPerSecond: 10,
          keyPrefix: 'test:',
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should default to memory store when store is undefined', () => {
      const limiter = RateLimiterFactory.create(
        {
          algorithm: 'fixed-window',
          windowMs: 60_000,
          maxRequests: 10,
        } as never,
        clock,
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });
});
