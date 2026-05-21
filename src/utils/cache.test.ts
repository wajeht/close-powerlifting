import { describe, expect, it, vi } from "vite-plus/test";

import { createMemoryCache } from "./cache";

describe("memory cache", () => {
  it("returns cached values until the ttl expires", async () => {
    let now = 1_000;
    const cache = createMemoryCache<number>({
      ttlMs: 100,
      now: () => now,
    });

    const firstFactory = vi.fn(() => 1);
    const secondFactory = vi.fn(() => 2);

    await expect(cache.getOrSet("status", firstFactory)).resolves.toBe(1);
    await expect(cache.getOrSet("status", secondFactory)).resolves.toBe(1);
    expect(firstFactory).toHaveBeenCalledTimes(1);
    expect(secondFactory).not.toHaveBeenCalled();

    now = 1_101;

    await expect(cache.getOrSet("status", secondFactory)).resolves.toBe(2);
    expect(secondFactory).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent cache misses", async () => {
    const cache = createMemoryCache<number>({ ttlMs: 100 });
    let resolveFactory: (value: number) => void = () => {};
    const pending = new Promise<number>((resolve) => {
      resolveFactory = resolve;
    });
    const factory = vi.fn(() => pending);

    const first = cache.getOrSet("status", factory);
    const second = cache.getOrSet("status", factory);
    resolveFactory(7);

    await expect(Promise.all([first, second])).resolves.toEqual([7, 7]);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
