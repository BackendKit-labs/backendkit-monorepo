import { IRateLimiterStore } from '../interfaces/store.interface';
import { MemoryStore } from './memory.store';
import { RedisStore, RedisStoreOptions } from './redis.store';
import { Clock } from '../utils';

type StoreConstructor = new (clock?: Clock) => IRateLimiterStore;

const STORE_MAP: Record<string, StoreConstructor> = {
  memory: MemoryStore,
};

export function resolveStoreType(name: string): StoreConstructor {
  const Ctor = STORE_MAP[name];
  if (!Ctor) {
    throw new Error(`Unknown store: ${name}. Available: ${Object.keys(STORE_MAP).join(', ')}`);
  }
  return Ctor;
}

export function createStore(name: string, clock?: Clock): IRateLimiterStore {
  const Ctor = resolveStoreType(name);
  return new Ctor(clock);
}

export function createRedisStore(options?: RedisStoreOptions): RedisStore {
  return new RedisStore(options);
}

export function getAvailableStores(): string[] {
  return Object.keys(STORE_MAP);
}
