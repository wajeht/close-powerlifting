import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";

import type { CacheType, LoggerType } from "../../../context";
import { createHealthCheckService } from "./health-check.service";

function createMockCache(): CacheType {
  const store = new Map<string, { value: string; updated_at: string }>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key)?.value || null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, { value, updated_at: new Date().toISOString() });
      return Promise.resolve();
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    delPattern: vi.fn(() => Promise.resolve(0)),
    keys: vi.fn(() => Promise.resolve([])),
    clearAll: vi.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
    isReady: vi.fn(() => true),
    getStatistics: vi.fn(() =>
      Promise.resolve({ totalEntries: 0, oldestEntry: null, newestEntry: null, keyPatterns: [] }),
    ),
    getEntries: vi.fn(() => Promise.resolve([])),
    countEntries: vi.fn(() => Promise.resolve(0)),
  };
}

function createMockLogger(): LoggerType {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    box: vi.fn(),
    setLevel: vi.fn(),
  };
}

function mockFetch(
  options: { ok?: boolean; date?: string; body?: string | null } = {},
): ReturnType<typeof vi.spyOn> {
  const { ok = true, date = "2024-01-01T00:00:00Z", body = '{"status":"success"}' } = options;
  return vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(
      new Response(body ?? "", {
        status: ok ? 200 : 500,
        headers: { date },
      }),
    ),
  );
}

describe("health-check service", () => {
  const EXPECTED_GROUPS = ["Rankings", "Federations", "Meets", "Records", "Users", "Public"];
  const TOTAL_ROUTES = 54;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAPIStatus", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("falls back to refreshAPIStatus when cache is empty", async () => {
      const fetchSpy = mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      expect(result.length).toBe(EXPECTED_GROUPS.length);
      expect(fetchSpy).toHaveBeenCalledTimes(TOTAL_ROUTES);
    });

    it("returns cached data without fetching", async () => {
      const fetchSpy = mockFetch();
      const cache = createMockCache();
      const service = createHealthCheckService(cache, createMockLogger());

      await service.refreshAPIStatus({ apiKey: "test-key", url: "http://localhost" });
      fetchSpy.mockClear();

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(EXPECTED_GROUPS.length);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("refreshAPIStatus", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns grouped route statuses", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(EXPECTED_GROUPS.length);
    });

    it("returns groups in correct order", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      expect(result.map((g) => g.name)).toEqual(EXPECTED_GROUPS);
    });

    it("each group has name and routes properties", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      for (const group of result) {
        expect(group).toHaveProperty("name");
        expect(group).toHaveProperty("routes");
        expect(Array.isArray(group.routes)).toBe(true);
      }
    });

    it("each route has required properties", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      for (const group of result) {
        for (const route of group.routes) {
          expect(route).toHaveProperty("status");
          expect(route).toHaveProperty("method");
          expect(route).toHaveProperty("url");
          expect(route).toHaveProperty("date");
          expect(typeof route.status).toBe("boolean");
          expect(route.method).toBe("GET");
          expect(typeof route.url).toBe("string");
          expect(typeof route.date).toBe("string");
        }
      }
    });

    it("Rankings group has correct number of routes", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const rankingsGroup = result.find((g) => g.name === "Rankings");
      expect(rankingsGroup).toBeDefined();
      expect(rankingsGroup!.routes.length).toBe(22);
    });

    it("Federations group has correct number of routes", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const federationsGroup = result.find((g) => g.name === "Federations");
      expect(federationsGroup).toBeDefined();
      expect(federationsGroup!.routes.length).toBe(5);
    });

    it("Records group has correct number of routes", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const recordsGroup = result.find((g) => g.name === "Records");
      expect(recordsGroup).toBeDefined();
      expect(recordsGroup!.routes.length).toBe(8);
    });

    it("Users group has correct number of routes", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const usersGroup = result.find((g) => g.name === "Users");
      expect(usersGroup).toBeDefined();
      expect(usersGroup!.routes.length).toBe(10);
    });

    it("Public group has correct number of routes", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const publicGroup = result.find((g) => g.name === "Public");
      expect(publicGroup).toBeDefined();
      expect(publicGroup!.routes.length).toBe(2);
    });

    it("sets status to true when request succeeds", async () => {
      mockFetch({ ok: true });
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const allStatuses = result.flatMap((g) => g.routes.map((r) => r.status));
      expect(allStatuses.every((s) => s === true)).toBe(true);
    });

    it("sets status to false when request fails", async () => {
      mockFetch({ ok: false });
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const allStatuses = result.flatMap((g) => g.routes.map((r) => r.status));
      expect(allStatuses.every((s) => s === false)).toBe(true);
    });

    it("caches the result after fetch", async () => {
      mockFetch();
      const cache = createMockCache();
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, logger);

      await service.refreshAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      expect(cache.set).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith("Global status cache was updated!");
    });

    it("includes response body on each successful route", async () => {
      mockFetch({ ok: true, body: '{"status":"success","data":[]}' });
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const allBodies = result.flatMap((g) => g.routes.map((r) => r.body));
      expect(allBodies.every((b) => b === '{"status":"success","data":[]}')).toBe(true);
    });

    it("leaves body null for failed routes", async () => {
      mockFetch({ ok: false, body: '{"error":"oops"}' });
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const allBodies = result.flatMap((g) => g.routes.map((r) => r.body));
      expect(allBodies.every((b) => b === null)).toBe(true);
    });

    it("new feature routes are present in rankings group", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const rankingsGroup = result.find((g) => g.name === "Rankings");
      const urls = rankingsGroup!.routes.map((r) => r.url);
      expect(urls.some((u) => u.includes("units=kg"))).toBe(true);
      expect(urls.some((u) => u.includes("federation=uspa"))).toBe(true);
      expect(urls.some((u) => u.includes("federation=ipf"))).toBe(true);
      expect(urls.some((u) => u.includes("age_class=40-44"))).toBe(true);
      expect(urls.some((u) => u.includes("age_class=24-34"))).toBe(true);
      for (const sort of [
        "by-dots",
        "by-wilks",
        "by-glossbrenner",
        "by-goodlift",
        "by-mcculloch",
        "by-total",
        "by-squat",
        "by-bench",
        "by-deadlift",
      ]) {
        expect(urls.some((u) => u.includes(sort))).toBe(true);
      }
    });

    it("new feature routes are present in users group", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const usersGroup = result.find((g) => g.name === "Users");
      const urls = usersGroup!.routes.map((r) => r.url);
      expect(urls.some((u) => u.includes("include_attempts=true"))).toBe(true);
      expect(urls.some((u) => u.includes("units=kg"))).toBe(true);
    });

    it("derived endpoints (progression, PBs, rank, compare, fed-stats) are tracked", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const allUrls = result.flatMap((g) => g.routes.map((r) => r.url));

      expect(allUrls).toContain("/api/users/johnhaack/progression");
      expect(allUrls).toContain("/api/users/johnhaack/personal-bests");
      expect(allUrls).toContain("/api/users/johnhaack/rank");
      expect(allUrls.some((u) => u.startsWith("/api/users/compare?"))).toBe(true);
      expect(allUrls).toContain("/api/federations/ipf/stats");
    });

    it("routes in each group have correct URL patterns", async () => {
      mockFetch();
      const service = createHealthCheckService(createMockCache(), createMockLogger());

      const result = await service.refreshAPIStatus({
        apiKey: "test-key",
        url: "http://localhost",
      });

      const rankingsGroup = result.find((g) => g.name === "Rankings");
      expect(rankingsGroup!.routes.every((r) => r.url.includes("/api/rankings"))).toBe(true);

      const federationsGroup = result.find((g) => g.name === "Federations");
      expect(federationsGroup!.routes.every((r) => r.url.includes("/api/federations"))).toBe(true);

      const recordsGroup = result.find((g) => g.name === "Records");
      expect(recordsGroup!.routes.every((r) => r.url.includes("/api/records"))).toBe(true);

      const usersGroup = result.find((g) => g.name === "Users");
      expect(usersGroup!.routes.every((r) => r.url.includes("/api/users"))).toBe(true);
    });
  });
});
