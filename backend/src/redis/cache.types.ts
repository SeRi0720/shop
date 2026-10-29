export interface CacheStore {
  /** REDIS_ENABLED && CACHE_ENABLED */
  readonly enabled: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
}
export const CACHE_STORE = Symbol('CACHE_STORE');
