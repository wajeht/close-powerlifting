import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createCron } from "./cron";
import { knex } from "./tests/test-setup";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { ApiCallLogRepositoryType } from "./db/api-call-log";
import type { MailType } from "./mail";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";
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

function createTestScraper(cache?: CacheType): ScraperType {
  const mockDoc = {
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementsByClassName: () => [],
  } as unknown as Document;

  const mockElement = {
    querySelectorAll: () => [],
    querySelector: () => null,
  } as unknown as Element;

  return {
    fetchHtml: vi.fn().mockResolvedValue("<html></html>"),
    fetchJson: vi.fn().mockResolvedValue({ rows: [], total_length: 0 }),
    parseHtml: vi.fn().mockReturnValue(mockDoc),
    tableToJson: vi.fn().mockReturnValue([]),
    getElementByClass: vi.fn().mockReturnValue(mockElement),
    buildPaginationQuery: vi.fn().mockReturnValue("start=0&end=100&lang=en&units=lbs"),
    stripHtml: vi.fn(),
    getElementText: vi.fn(),
    withCache: vi.fn(),
    refreshCache: vi.fn(async (key: string, fetcher: () => Promise<unknown>) => {
      const data = await fetcher();
      if (cache) await cache.set(key, JSON.stringify(data));
      return { data };
    }),
    calculatePagination: vi.fn(),
    fetchWithAuth: vi.fn(),
  } as unknown as ScraperType;
}

describe("cron", () => {
  let cache: CacheType;
  let logger: LoggerType;
  let scraper: ScraperType;
  let userRepository: UserRepositoryType;
  let mail: MailType;
  let apiCallLogRepository: ApiCallLogRepositoryType;
  let ingest: IngestServiceType;

  beforeEach(() => {
    cache = createTestCache();
    logger = createTestLogger();
    scraper = createTestScraper(cache);
    userRepository = {
      findVerifiedWithUsage: vi.fn().mockResolvedValue([]),
      resetAllApiCallCounts: vi.fn().mockResolvedValue(undefined),
      findByApiCallCount: vi.fn().mockResolvedValue([]),
      findByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepositoryType;
    mail = {
      sendApiLimitResetEmail: vi.fn().mockResolvedValue(undefined),
      sendReachingApiLimitEmail: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailType;
    apiCallLogRepository = {
      deleteOlderThan: vi.fn().mockResolvedValue(0),
    } as unknown as ApiCallLogRepositoryType;
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
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );

      expect(cron).toHaveProperty("start");
      expect(cron).toHaveProperty("stop");
      expect(cron).toHaveProperty("getStatus");
      expect(cron).toHaveProperty("tasks");
    });

    it("should return not running status initially", () => {
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should update status after start", () => {
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      cron.start();

      const status = cron.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.jobCount).toBe(6);

      cron.stop();
    });

    it("should update status after stop", () => {
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      cron.start();
      cron.stop();

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should log when started and stopped", () => {
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      cron.start();

      expect(logger.info).toHaveBeenCalledWith("cron service started", { jobs: 6 });

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

    it("should refresh status data from cache", async () => {
      await seedCache(cache, ["status"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/status");
    });

    it("should refresh federations list from cache", async () => {
      await seedCache(cache, ["federations-list"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      const cached = await cache.get("federations-list");
      expect(cached).not.toBeNull();
    });

    it("should refresh records from cache", async () => {
      await seedCache(cache, ["records"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      const cached = await cache.get("records");
      expect(cached).not.toBeNull();
    });

    it("should refresh rankings keys from cache", async () => {
      await seedCache(cache, ["rankings-1-100-lbs", "rankings-2-100-lbs"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      const cached1 = await cache.get("rankings-1-100-lbs");
      const cached2 = await cache.get("rankings-2-100-lbs");
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
      expect(JSON.parse(cached1!)).not.toEqual({ placeholder: true });
    });

    it("should refresh filtered rankings keys", async () => {
      await seedCache(cache, ["rankings/raw-1-100-lbs", "rankings/raw/men-1-100-lbs"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      const cached1 = await cache.get("rankings/raw-1-100-lbs");
      const cached2 = await cache.get("rankings/raw/men-1-100-lbs");
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
    });

    it("should refresh federation keys", async () => {
      await seedCache(cache, ["federation-ipf", "federation-uspa-2024"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/ipf");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/uspa/2024");
    });

    it("should handle federation keys with hyphenated names and year", async () => {
      await seedCache(cache, ["federation-usa-pl-2020", "federation-all-russia"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/usa-pl/2020");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/all-russia");
    });

    it("should refresh meet keys", async () => {
      await seedCache(cache, ["meet-uspa/1969"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/m/uspa/1969", undefined);
    });

    it("should refresh user keys", async () => {
      await seedCache(cache, ["user-johnhaack-lbs"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/u/johnhaack", "lbs");
    });

    it("should refresh records with filter path", async () => {
      await seedCache(cache, ["records/raw", "records/raw/men"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/raw");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/raw/men");
    });

    it("should skip internal cache keys", async () => {
      await seedCache(cache, ["hostname", "close-powerlifting-global-status-call-cache", "status"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
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
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
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

    it("should handle fetchHtml errors and continue", async () => {
      await seedCache(cache, ["status", "federations-list"]);
      vi.mocked(scraper.fetchHtml)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("<html></html>");

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh status",
        expect.any(Object),
      );
      // Should continue with other endpoints
      const fedCached = await cache.get("federations-list");
      expect(fedCached).not.toBeNull();
    });

    it("should handle fetchJson errors for rankings", async () => {
      await seedCache(cache, ["rankings-1-100-lbs"]);
      vi.mocked(scraper.fetchJson).mockRejectedValueOnce(new Error("API error"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh rankings-1-100-lbs",
        expect.any(Object),
      );
    });

    it("should handle missing text-content element", async () => {
      await seedCache(cache, ["status"]);
      vi.mocked(scraper.getElementByClass).mockReturnValueOnce(null);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh status",
        expect.objectContaining({ error: "Could not find text-content element on status page" }),
      );
    });

    it("should report partial failures in summary", async () => {
      await seedCache(cache, ["status", "federations-list", "records"]);
      vi.mocked(scraper.fetchHtml)
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValue("<html></html>");

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 3,
          successful: 1,
          failed: 2,
        }),
      );
    });

    it("should do nothing when cache is empty", async () => {
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
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

    // Edge cases for rankings
    it("should handle rankings with page > 1 correctly", async () => {
      await seedCache(cache, ["rankings-3-100-lbs"]);
      vi.mocked(scraper.buildPaginationQuery).mockReturnValueOnce(
        "start=200&end=300&lang=en&units=lbs",
      );
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchJson).toHaveBeenCalledWith(
        "/rankings?start=200&end=300&lang=en&units=lbs",
      );
    });

    it("should handle deep filter path rankings from prod", async () => {
      await seedCache(cache, ["rankings/raw/men/100/2024/full-power/by-dots-1-100-lbs"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchJson).toHaveBeenCalledWith(
        "/rankings/raw/men/100/2024/full-power/by-dots?start=0&end=100&lang=en&units=lbs",
      );
    });

    it("should handle rankings with small perPage", async () => {
      await seedCache(cache, ["rankings-1-9-lbs"]);
      vi.mocked(scraper.buildPaginationQuery).mockReturnValueOnce(
        "start=0&end=9&lang=en&units=lbs",
      );
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchJson).toHaveBeenCalledWith("/rankings?start=0&end=9&lang=en&units=lbs");
    });

    it("should warn on invalid rankings key format", async () => {
      await seedCache(cache, ["rankings-invalid"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: rankings-invalid",
      );
    });

    it("should warn on rankings key with non-numeric page/perPage", async () => {
      await seedCache(cache, ["rankings-abc-def-lbs"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: rankings-abc-def-lbs",
      );
    });

    // Edge cases for records
    it("should handle deep records filter paths from prod", async () => {
      await seedCache(cache, [
        "records/unlimited/para-classes/women",
        "records/raw/expanded-classes/men",
        "records/all-tested/women",
      ]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/unlimited/para-classes/women");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/raw/expanded-classes/men");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/all-tested/women");
    });

    // Edge cases for federations
    it("should not treat short numbers as years", async () => {
      // federation-365strong should NOT be parsed as year=365
      await seedCache(cache, ["federation-365strong"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/365strong");
    });

    it("should handle federation ending in 3 digit number", async () => {
      await seedCache(cache, ["federation-uspa-123"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      // 123 is not 4 digits, so it's part of the federation name
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/uspa-123");
    });

    // Edge cases for meets
    it("should handle meet codes with multiple path segments", async () => {
      await seedCache(cache, ["meet-wrpf-ru/2301", "meet-gpc/aus-vic/2023"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/m/wrpf-ru/2301", undefined);
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/m/gpc/aus-vic/2023", undefined);
    });

    // Edge cases for users
    it("should handle user profile fetch failure", async () => {
      await seedCache(cache, ["user-nonexistent-lbs"]);
      vi.mocked(scraper.getElementByClass).mockReturnValueOnce(null);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh user-nonexistent-lbs",
        expect.objectContaining({ error: "User profile not found: nonexistent" }),
      );
    });

    it("should handle usernames with hyphens", async () => {
      await seedCache(cache, ["user-john-doe-lbs"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/u/john-doe", "lbs");
    });

    it("should refresh cached user search keys", async () => {
      await seedCache(cache, ["users-search-john%20haack-2-5-kg"]);
      vi.mocked(scraper.fetchJson)
        .mockResolvedValueOnce({ next_index: 42 })
        .mockResolvedValueOnce({ rows: [], total_length: 0 });

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(scraper.fetchJson).toHaveBeenCalledWith("/search/rankings?q=john%20haack&start=5");
      expect(scraper.fetchJson).toHaveBeenCalledWith("/rankings?start=42&end=47&lang=en&units=kg");
      expect(logger.warn).not.toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: users-search-john%20haack-2-5-kg",
      );
    });

    it("should warn on invalid user search cache keys", async () => {
      await seedCache(cache, ["users-search-haack-invalid"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: unknown key type: users-search-haack-invalid",
      );
    });

    // Unknown key type
    it("should warn on unknown key types", async () => {
      await seedCache(cache, ["unknown-key-type"]);
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
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
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
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
      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshHealthCheck();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshHealthCheck: hostname not cached yet, skipping",
      );
    });

    it("should skip when admin user is not found", async () => {
      await cache.set("hostname", "http://localhost");

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
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

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshHealthCheck();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: refreshHealthCheck");
    });

    it("should log error on failure", async () => {
      await cache.set("hostname", "http://localhost");
      vi.mocked(userRepository.findByEmail).mockRejectedValueOnce(new Error("db error"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.refreshHealthCheck();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: refreshHealthCheck",
        expect.any(Error),
      );
    });
  });

  describe("resetApiCallCount task", () => {
    const RESET_MARKER_KEY = "api-call-count-last-reset-month";

    it("should reset and set marker when no previous reset is recorded", async () => {
      vi.setSystemTime(new Date("2024-04-15T00:05:00Z"));

      const mockUsers = [{ email: "test@test.com", name: "Test", api_call_count: 42 }];
      vi.mocked(userRepository.findVerifiedWithUsage).mockResolvedValue(mockUsers as never);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).toHaveBeenCalled();
      expect(await cache.get(RESET_MARKER_KEY)).toBe("2024-04");
      expect(mail.sendApiLimitResetEmail).toHaveBeenCalledWith({
        email: "test@test.com",
        name: "Test",
      });
    });

    it("should skip when already reset this month", async () => {
      vi.setSystemTime(new Date("2024-04-15T00:05:00Z"));
      await cache.set(RESET_MARKER_KEY, "2024-04");

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).not.toHaveBeenCalled();
      expect(mail.sendApiLimitResetEmail).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "cron job skipped: resetApiCallCount (already reset this month)",
        { currentMonth: "2024-04" },
      );
    });

    it("should reset when marker is from a previous month", async () => {
      vi.setSystemTime(new Date("2024-05-01T00:05:00Z"));
      await cache.set(RESET_MARKER_KEY, "2024-04");

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).toHaveBeenCalled();
      expect(await cache.get(RESET_MARKER_KEY)).toBe("2024-05");
    });

    // Regression: the old implementation only reset when getDate() === 1.
    // If the cron's day-1 firing was missed (server down/deploy), the entire
    // month was skipped. The marker-based check must self-heal on day 2+.
    it("should self-heal: reset on day 2+ if first-day window was missed", async () => {
      vi.setSystemTime(new Date("2024-05-15T00:05:00Z"));
      await cache.set(RESET_MARKER_KEY, "2024-04");

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).toHaveBeenCalled();
      expect(await cache.get(RESET_MARKER_KEY)).toBe("2024-05");
    });

    it("should be idempotent across multiple firings within the same month", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();
      await cron.tasks.resetApiCallCount();
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).toHaveBeenCalledTimes(1);
    });

    it("should pad single-digit months in the marker (UTC YYYY-MM)", async () => {
      vi.setSystemTime(new Date("2024-01-01T00:05:00Z"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(await cache.get(RESET_MARKER_KEY)).toBe("2024-01");
    });

    it("should send emails to all verified users", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));

      const mockUsers = [
        { email: "user1@test.com", name: "User 1", api_call_count: 1 },
        { email: "user2@test.com", name: "User 2", api_call_count: 50 },
        { email: "user3@test.com", name: "User 3", api_call_count: 100 },
      ];
      vi.mocked(userRepository.findVerifiedWithUsage).mockResolvedValue(mockUsers as never);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(mail.sendApiLimitResetEmail).toHaveBeenCalledTimes(3);
    });

    it("should send no emails when no verified user has usage (DB returns empty)", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));
      // findVerifiedWithUsage filters at the SQL layer, so a DB with all-zero
      // users surfaces here as an empty list — we still reset and set the
      // marker so the cron doesn't retry later in the month.
      vi.mocked(userRepository.findVerifiedWithUsage).mockResolvedValue([]);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).toHaveBeenCalled();
      expect(mail.sendApiLimitResetEmail).not.toHaveBeenCalled();
      expect(await cache.get(RESET_MARKER_KEY)).toBe("2024-04");
    });

    it("should handle findVerifiedWithUsage error", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));
      vi.mocked(userRepository.findVerifiedWithUsage).mockRejectedValue(new Error("DB error"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: resetApiCallCount",
        expect.any(Error),
      );
      // Marker must NOT be set when reset never happened, so next firing retries.
      expect(await cache.get(RESET_MARKER_KEY)).toBeNull();
    });

    it("should handle resetAllApiCallCounts error and not set marker", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));
      vi.mocked(userRepository.findVerifiedWithUsage).mockResolvedValue([
        { email: "a@b.com", name: "A", api_call_count: 5 },
      ] as never);
      vi.mocked(userRepository.resetAllApiCallCounts).mockRejectedValue(new Error("DB error"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: resetApiCallCount",
        expect.any(Error),
      );
      expect(await cache.get(RESET_MARKER_KEY)).toBeNull();
    });

    it("should log completion on success", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));
      vi.mocked(userRepository.findVerifiedWithUsage).mockResolvedValue([]);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: resetApiCallCount");
    });

    it("should continue sending emails when one fails", async () => {
      vi.setSystemTime(new Date("2024-04-01T00:05:00Z"));

      const mockUsers = [
        { email: "user1@test.com", name: "User 1", api_call_count: 10 },
        { email: "user2@test.com", name: "User 2", api_call_count: 20 },
        { email: "user3@test.com", name: "User 3", api_call_count: 30 },
      ];
      vi.mocked(userRepository.findVerifiedWithUsage).mockResolvedValue(mockUsers as never);
      vi.mocked(mail.sendApiLimitResetEmail)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("SMTP error"))
        .mockResolvedValueOnce(undefined);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.resetApiCallCount();

      expect(mail.sendApiLimitResetEmail).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledWith("resetApiCallCount: 1/3 emails failed to send");
      expect(logger.info).toHaveBeenCalledWith("cron job completed: resetApiCallCount");
      // Marker is set even when some emails fail (reset itself succeeded).
      expect(await cache.get(RESET_MARKER_KEY)).toBe("2024-04");
    });
  });

  describe("sendReachingApiLimitEmail task", () => {
    it("should send emails to users at 70% limit", async () => {
      const mockUsers = [{ email: "user@test.com", name: "User" }];
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue(mockUsers as never);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).toHaveBeenCalledWith({
        email: "user@test.com",
        name: "User",
        percent: 70,
      });
    });

    it("should not send emails if no users at limit", async () => {
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue([]);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).not.toHaveBeenCalled();
    });

    it("should send emails to all users at limit", async () => {
      const mockUsers = [
        { email: "user1@test.com", name: "User 1" },
        { email: "user2@test.com", name: "User 2" },
      ];
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue(mockUsers as never);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).toHaveBeenCalledTimes(2);
    });

    it("should handle findByApiCallCount error", async () => {
      vi.mocked(userRepository.findByApiCallCount).mockRejectedValue(new Error("DB error"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.sendReachingApiLimitEmail();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: sendReachingApiLimitEmail",
        expect.any(Error),
      );
    });

    it("should log completion on success", async () => {
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue([]);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.sendReachingApiLimitEmail();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: sendReachingApiLimitEmail");
    });

    it("should continue sending emails when one fails", async () => {
      const mockUsers = [
        { email: "user1@test.com", name: "User 1" },
        { email: "user2@test.com", name: "User 2" },
      ];
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue(mockUsers as never);
      vi.mocked(mail.sendReachingApiLimitEmail)
        .mockRejectedValueOnce(new Error("SMTP error"))
        .mockResolvedValueOnce(undefined);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        "sendReachingApiLimitEmail: 1/2 emails failed to send",
      );
      expect(logger.info).toHaveBeenCalledWith("cron job completed: sendReachingApiLimitEmail");
    });
  });

  describe("cleanupOldApiCallLogs task", () => {
    it("should call deleteOlderThan with correct cutoff date", async () => {
      const mockDate = new Date("2024-03-15T12:00:00Z");
      vi.setSystemTime(mockDate);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.cleanupOldApiCallLogs();

      expect(apiCallLogRepository.deleteOlderThan).toHaveBeenCalledWith(expect.any(Date));
      const callArg = vi.mocked(apiCallLogRepository.deleteOlderThan).mock.calls[0][0];
      const daysDiff = Math.round((mockDate.getTime() - callArg.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(90);
    });

    it("should log completion with deleted count when logs deleted", async () => {
      vi.mocked(apiCallLogRepository.deleteOlderThan).mockResolvedValue(42);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.cleanupOldApiCallLogs();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: cleanupOldApiCallLogs - deleted 42 logs",
      );
    });

    it("should log completion when no logs to delete", async () => {
      vi.mocked(apiCallLogRepository.deleteOlderThan).mockResolvedValue(0);

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.cleanupOldApiCallLogs();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: cleanupOldApiCallLogs - no logs to delete",
      );
    });

    it("should handle deleteOlderThan error", async () => {
      vi.mocked(apiCallLogRepository.deleteOlderThan).mockRejectedValue(new Error("DB error"));

      const cron = createCron(
        cache,
        userRepository,
        mail,
        logger,
        scraper,
        apiCallLogRepository,
        ingest,
        knex,
      );
      await cron.tasks.cleanupOldApiCallLogs();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: cleanupOldApiCallLogs",
        expect.any(Error),
      );
    });
  });
});
