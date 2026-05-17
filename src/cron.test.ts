import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createCron } from "./cron";
import { knex } from "./tests/test-setup";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { LoggerType } from "./utils/logger";
import type { HttpClientType } from "./utils/http-client";
import type { IngestServiceType } from "./utils/ingest";

function createTestCache(): CacheType {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    del: async (key) => {
      store.delete(key);
    },
    delPattern: async (pattern) => {
      let count = 0;
      for (const key of store.keys()) {
        if (key.includes(pattern.replace(/%/g, ""))) {
          store.delete(key);
          count++;
        }
      }
      return count;
    },
    keys: async (pattern) => {
      // Return all keys when pattern is '%'
      if (pattern === "%") {
        return Array.from(store.keys());
      }
      return Array.from(store.keys()).filter((k) => k.includes(pattern.replace(/%/g, "")));
    },
    clearAll: async () => {
      store.clear();
    },
    isReady: () => true,
    getStatistics: async () => ({
      totalEntries: store.size,
      oldestEntry: null,
      newestEntry: null,
      keyPatterns: [],
    }),
    getEntries: async () => [],
    countEntries: async () => store.size,
  };
}

function createTestLogger(): LoggerType {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as LoggerType;
}

function createTestHttpClient(): HttpClientType {
  return {
    fetchWithAuth: vi.fn().mockResolvedValue({ ok: true, url: "", date: null, body: null }),
  } as unknown as HttpClientType;
}

describe("cron", () => {
  let cache: CacheType;
  let logger: LoggerType;
  let httpClient: HttpClientType;
  let userRepository: UserRepositoryType;
  let ingest: IngestServiceType;

  beforeEach(() => {
    cache = createTestCache();
    logger = createTestLogger();
    httpClient = createTestHttpClient();
    userRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepositoryType;
    ingest = {
      runNightly: vi.fn().mockResolvedValue({
        status: "completed",
        rowCount: 0,
        byteSize: null,
        durationMs: 0,
        sourceLastModified: null,
      }),
      ingestFromStream: vi.fn(),
    } as unknown as IngestServiceType;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createCron", () => {
    it("should create cron with correct interface", () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);

      expect(cron).toHaveProperty("start");
      expect(cron).toHaveProperty("stop");
      expect(cron).toHaveProperty("getStatus");
      expect(cron).toHaveProperty("tasks");
    });

    it("should return not running status initially", () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should update status after start", () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      cron.start();

      const status = cron.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.jobCount).toBe(3);

      cron.stop();
    });

    it("should update status after stop", () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      cron.start();
      cron.stop();

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should log when started and stopped", () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      cron.start();

      expect(logger.info).toHaveBeenCalledWith("cron service started", { jobs: 3 });

      cron.stop();

      expect(logger.info).toHaveBeenCalledWith("cron service stopped");
    });
  });

  describe("refreshCache task", () => {
    async function seedCache(
      cacheInstance: CacheType,
      keys: string[] = ["status", "federations-list", "records"],
    ) {
      for (const key of keys) {
        await cacheInstance.set(key, JSON.stringify({ placeholder: true }));
      }
    }

    it("claims status key", async () => {
      await seedCache(cache, ["status"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("should refresh federations list from cache", async () => {
      await seedCache(cache, ["federations-list"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      const cached = await cache.get("federations-list");
      expect(cached).not.toBeNull();
    });

    it("should refresh records from cache", async () => {
      await seedCache(cache, ["records"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      const cached = await cache.get("records");
      expect(cached).not.toBeNull();
    });

    it("claims rankings keys", async () => {
      await seedCache(cache, ["rankings-1-100-lbs", "rankings-2-100-lbs"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("should refresh filtered rankings keys", async () => {
      await seedCache(cache, ["rankings/raw-1-100-lbs", "rankings/raw/men-1-100-lbs"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      const cached1 = await cache.get("rankings/raw-1-100-lbs");
      const cached2 = await cache.get("rankings/raw/men-1-100-lbs");
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
    });

    it("claims federation keys", async () => {
      await seedCache(cache, ["federation-ipf", "federation-uspa-2024"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("claims meet keys", async () => {
      await seedCache(cache, ["meet-uspa/1969"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("claims user profile keys", async () => {
      await seedCache(cache, ["user-johnhaack-lbs"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("claims records keys", async () => {
      await seedCache(cache, ["records/raw", "records/raw/men"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("should skip internal cache keys", async () => {
      await seedCache(cache, ["hostname", "close-powerlifting-global-status-call-cache", "status"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      // Only status should be refreshed
      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 1,
        }),
      );
    });

    it("should log completion with results summary", async () => {
      await seedCache(cache, ["status", "federations-list", "records"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 3,
          successful: 3,
          failed: 0,
        }),
      );
    });

    // fetchHtml/getElementByClass error paths can no longer fire.

    it("should report cache-key counts in summary", async () => {
      await seedCache(cache, ["status", "records", "federation-ipf"]);

      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 3,
          successful: 3,
          failed: 0,
        }),
      );
    });

    it("should do nothing when cache is empty", async () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 0,
          successful: 0,
          failed: 0,
        }),
      );
    });

    // the lifts table; legacy fetchJson-based assertions no longer apply.
    it("claims deep filter path rankings keys", async () => {
      await seedCache(cache, ["rankings/raw/men/100/2024/full-power/by-dots-1-100-lbs"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("should warn on invalid rankings key format", async () => {
      await seedCache(cache, ["rankings-invalid"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: rankings-invalid",
      );
    });

    it("should warn on rankings key with non-numeric page/perPage", async () => {
      await seedCache(cache, ["rankings-abc-def-lbs"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: rankings-abc-def-lbs",
      );
    });

    it("claims deep records filter paths", async () => {
      await seedCache(cache, [
        "records/unlimited/para-classes/women",
        "records/raw/expanded-classes/men",
        "records/all-tested/women",
      ]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    // comes from the lifts table; we only verify the cron didn't scrape.
    it("claims federation-365strong", async () => {
      await seedCache(cache, ["federation-365strong"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("claims deep meet path keys", async () => {
      await seedCache(cache, ["meet-wrpf-ru/2301", "meet-gpc/aus-vic/2023"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("claims usernames-with-hyphens profile keys", async () => {
      await seedCache(cache, ["user-john-doe-lbs"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
    });

    it("claims user search keys", async () => {
      await seedCache(cache, ["users-search-john%20haack-2-5-kg"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();
      expect(logger.warn).not.toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: users-search-john%20haack-2-5-kg",
      );
    });

    it("should warn on invalid user search cache keys", async () => {
      await seedCache(cache, ["users-search-haack-invalid"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: users-search-haack-invalid",
      );
    });

    it("should warn on unknown key types", async () => {
      await seedCache(cache, ["unknown-key-type"]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: unknown-key-type",
      );
    });

    // Mixed key types in single refresh
    it("should handle all key types in single refresh", async () => {
      await seedCache(cache, [
        "status",
        "federations-list",
        "federation-ipf-2024",
        "meet-uspa/1969",
        "records/raw/men",
        "user-johnhaack-lbs",
        "rankings-1-100-lbs",
      ]);
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 7,
          successful: 7,
          failed: 0,
        }),
      );
    });
  });

  describe("refreshHealthCheck task", () => {
    it("should skip when hostname is not cached", async () => {
      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshHealthCheck();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshHealthCheck: hostname not cached yet, skipping",
      );
    });

    it("should skip when admin user is not found", async () => {
      await cache.set("hostname", "http://localhost");

      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshHealthCheck();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshHealthCheck: admin user or API key not found, skipping",
      );
    });

    it("should refresh health check when hostname and admin exist", async () => {
      await cache.set("hostname", "http://localhost");
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce({
        api_key: "test-key",
      } as never);

      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshHealthCheck();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: refreshHealthCheck");
    });

    it("should log error on failure", async () => {
      await cache.set("hostname", "http://localhost");
      vi.mocked(userRepository.findByEmail).mockRejectedValueOnce(new Error("db error"));

      const cron = createCron(cache, userRepository, logger, httpClient, ingest, knex);
      await cron.tasks.refreshHealthCheck();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: refreshHealthCheck",
        expect.any(Error),
      );
    });
  });
});
