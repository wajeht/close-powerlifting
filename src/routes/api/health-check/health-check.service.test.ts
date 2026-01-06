import { describe, expect, it, vi, beforeEach } from "vitest";

import type { CacheType, ScraperType, LoggerType } from "../../../context";
import { createHealthCheckService } from "./health-check.service";

function createMockCache(): CacheType {
  const store = new Map<string, string>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
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
  };
}

function createMockLogger(): LoggerType {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    box: vi.fn(),
    setLevel: vi.fn(),
  };
}

function createMockScraper(responses: { ok: boolean; date: string }[]): ScraperType {
  let callIndex = 0;
  return {
    fetchWithAuth: vi.fn(() => {
      const response = responses[callIndex] || { ok: true, date: new Date().toISOString() };
      callIndex++;
      return Promise.resolve({
        ok: response.ok,
        url: "",
        date: response.date,
      });
    }),
  } as unknown as ScraperType;
}

describe("health-check service", () => {
  const EXPECTED_GROUPS = ["Rankings", "Federations", "Meets", "Records", "Users", "Public"];
  const TOTAL_ROUTES = 21;

  describe("getAPIStatus", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns grouped route statuses", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(EXPECTED_GROUPS.length);
    });

    it("returns groups in correct order", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const groupNames = result.map((g: { name: string }) => g.name);
      expect(groupNames).toEqual(EXPECTED_GROUPS);
    });

    it("each group has name and routes properties", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      for (const group of result) {
        expect(group).toHaveProperty("name");
        expect(group).toHaveProperty("routes");
        expect(Array.isArray(group.routes)).toBe(true);
      }
    });

    it("each route has required properties", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

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
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const rankingsGroup = result.find((g: { name: string }) => g.name === "Rankings");
      expect(rankingsGroup).toBeDefined();
      expect(rankingsGroup.routes.length).toBe(9);
    });

    it("Federations group has correct number of routes", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const federationsGroup = result.find((g: { name: string }) => g.name === "Federations");
      expect(federationsGroup).toBeDefined();
      expect(federationsGroup.routes.length).toBe(4);
    });

    it("Public group has correct number of routes", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const publicGroup = result.find((g: { name: string }) => g.name === "Public");
      expect(publicGroup).toBeDefined();
      expect(publicGroup.routes.length).toBe(2);
    });

    it("sets status to true when request succeeds", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const allStatuses = result.flatMap((g: { routes: { status: boolean }[] }) =>
        g.routes.map((r) => r.status),
      );
      expect(allStatuses.every((s: boolean) => s === true)).toBe(true);
    });

    it("sets status to false when request fails", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: false, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const allStatuses = result.flatMap((g: { routes: { status: boolean }[] }) =>
        g.routes.map((r) => r.status),
      );
      expect(allStatuses.every((s: boolean) => s === false)).toBe(true);
    });

    it("caches the result after first fetch", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      expect(cache.set).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith("Global status cache was updated!");
    });

    it("returns cached result on subsequent calls", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });
      await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      expect(scraper.fetchWithAuth).toHaveBeenCalledTimes(TOTAL_ROUTES);
      expect(cache.set).toHaveBeenCalledTimes(1);
    });

    it("routes in each group have correct URL patterns", async () => {
      const mockResponses = Array(TOTAL_ROUTES).fill({ ok: true, date: "2024-01-01T00:00:00Z" });
      const cache = createMockCache();
      const scraper = createMockScraper(mockResponses);
      const logger = createMockLogger();
      const service = createHealthCheckService(cache, scraper, logger);

      const result = await service.getAPIStatus({ apiKey: "test-key", url: "http://localhost" });

      const rankingsGroup = result.find((g: { name: string }) => g.name === "Rankings");
      expect(
        rankingsGroup.routes.every((r: { url: string }) => r.url.includes("/api/rankings")),
      ).toBe(true);

      const federationsGroup = result.find((g: { name: string }) => g.name === "Federations");
      expect(
        federationsGroup.routes.every((r: { url: string }) => r.url.includes("/api/federations")),
      ).toBe(true);

      const meetsGroup = result.find((g: { name: string }) => g.name === "Meets");
      expect(meetsGroup.routes.every((r: { url: string }) => r.url.includes("/api/meets"))).toBe(
        true,
      );

      const recordsGroup = result.find((g: { name: string }) => g.name === "Records");
      expect(
        recordsGroup.routes.every((r: { url: string }) => r.url.includes("/api/records")),
      ).toBe(true);

      const usersGroup = result.find((g: { name: string }) => g.name === "Users");
      expect(usersGroup.routes.every((r: { url: string }) => r.url.includes("/api/users"))).toBe(
        true,
      );
    });
  });
});
