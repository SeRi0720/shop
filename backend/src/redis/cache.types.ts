export interface CacheStore {
  /** REDIS_ENABLED && CACHE_ENABLED */
  readonly enabled: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
}
export const CACHE_STORE = Symbol('CACHE_STORE');
export interface CounterStore {
  readonly countersEnabled: boolean;
  hitWindow(key: string, windowMs: number): Promise<number>;
}
export const COUNTER_STORE = Symbol('COUNTER_STORE');
