interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface MemoryCacheOptions {
  ttlMs: number;
  now?: () => number;
}

export class MemoryCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: MemoryCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
  }

  get(key: string): T | undefined {
    const entry = this.values.get(key);
    if (entry == null) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  peek(key: string): T | undefined {
    return this.values.get(key)?.value;
  }

  set(key: string, value: T, ttlMs: number = this.ttlMs): T {
    this.values.set(key, {
      value,
      expiresAt: this.now() + ttlMs,
    });
    return value;
  }

  async getOrSet(
    key: string,
    factory: () => Promise<T> | T,
    ttlMs: number = this.ttlMs,
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inFlight.get(key);
    if (pending != null) return pending;

    const promise = Promise.resolve()
      .then(factory)
      .then((value) => this.set(key, value, ttlMs));
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  delete(key: string): boolean {
    this.inFlight.delete(key);
    return this.values.delete(key);
  }

  clear(): void {
    this.inFlight.clear();
    this.values.clear();
  }
}

export function createMemoryCache<T>(options: MemoryCacheOptions): MemoryCache<T> {
  return new MemoryCache<T>(options);
}
