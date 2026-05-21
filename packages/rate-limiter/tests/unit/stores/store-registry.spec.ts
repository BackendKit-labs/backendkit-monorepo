import { vi } from 'vitest';
import { resolveStoreType, createStore, createRedisStore, getAvailableStores } from '../../../src/stores/store-registry';
import { MemoryStore } from '../../../src/stores/memory.store';
import { ClockMock } from '../../helpers/clock-mock';

// Mock ioredis so RedisStore constructor does not attempt real connection
vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    flushdb: vi.fn().mockResolvedValue('OK'),
    script: vi.fn().mockResolvedValue('sha_mock'),
    evalsha: vi.fn().mockResolvedValue([1, 0, 0, 0]),
    eval: vi.fn().mockResolvedValue([1, 0, 0, 0]),
  }));
  return {
    default: MockRedis,
    Redis: MockRedis,
    Cluster: vi.fn().mockImplementation(() => ({})),
  };
});

describe('store-registry', () => {
  let clock: ClockMock;

  beforeEach(() => {
    clock = new ClockMock(1000);
  });

  describe('resolveStoreType', () => {
    it('should return MemoryStore constructor for "memory"', () => {
      const Ctor = resolveStoreType('memory');
      expect(Ctor).toBe(MemoryStore);
    });

    it('should throw for unknown store', () => {
      expect(() => resolveStoreType('unknown')).toThrow(/Unknown store/);
    });
  });

  describe('createStore', () => {
    it('should create a MemoryStore for "memory"', () => {
      const store = createStore('memory', clock);
      expect(store).toBeInstanceOf(MemoryStore);
    });

    it('should throw for unknown store', () => {
      expect(() => createStore('unknown', clock)).toThrow(/Unknown store/);
    });
  });

  describe('createRedisStore', () => {
    it('should create a RedisStore', () => {
      const store = createRedisStore({ host: 'localhost', port: 6379 });
      expect(store).toBeDefined();
    });

    it('should create a RedisStore without options', () => {
      const store = createRedisStore();
      expect(store).toBeDefined();
    });
  });

  describe('getAvailableStores', () => {
    it('should return available stores', () => {
      const stores = getAvailableStores();
      expect(stores).toContain('memory');
      expect(stores).not.toContain('redis'); // redis is not in STORE_MAP
    });
  });
});
