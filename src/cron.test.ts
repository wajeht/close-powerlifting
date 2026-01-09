import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCron } from "./cron";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { MailType } from "./mail";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";

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

function createTestScraper(): ScraperType {
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

  beforeEach(() => {
    cache = createTestCache();
    logger = createTestLogger();
    scraper = createTestScraper();
    userRepository = {
      findVerified: vi.fn().mockResolvedValue([]),
      resetAllApiCallCounts: vi.fn().mockResolvedValue(undefined),
      findByApiCallCount: vi.fn().mockResolvedValue([]),
    } as unknown as UserRepositoryType;
    mail = {
      sendApiLimitResetEmail: vi.fn().mockResolvedValue(undefined),
      sendReachingApiLimitEmail: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailType;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createCron", () => {
    it("should create cron with correct interface", () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);

      expect(cron).toHaveProperty("start");
      expect(cron).toHaveProperty("stop");
      expect(cron).toHaveProperty("getStatus");
      expect(cron).toHaveProperty("tasks");
    });

    it("should return not running status initially", () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should update status after start", () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      cron.start();

      const status = cron.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.jobCount).toBe(3);

      cron.stop();
    });

    it("should update status after stop", () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      cron.start();
      cron.stop();

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should log when started and stopped", () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
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

    it("should refresh status data from cache", async () => {
      await seedCache(cache, ["status"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached = await cache.get("status");
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!)).toHaveProperty("server_version");
    });

    it("should refresh federations list from cache", async () => {
      await seedCache(cache, ["federations-list"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached = await cache.get("federations-list");
      expect(cached).not.toBeNull();
    });

    it("should refresh records from cache", async () => {
      await seedCache(cache, ["records"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached = await cache.get("records");
      expect(cached).not.toBeNull();
    });

    it("should refresh rankings keys from cache", async () => {
      await seedCache(cache, ["rankings-1-100", "rankings-2-100"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached1 = await cache.get("rankings-1-100");
      const cached2 = await cache.get("rankings-2-100");
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
    });

    it("should refresh filtered rankings keys", async () => {
      await seedCache(cache, ["rankings/raw-1-100", "rankings/raw/men-1-100"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached1 = await cache.get("rankings/raw-1-100");
      const cached2 = await cache.get("rankings/raw/men-1-100");
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
    });

    it("should refresh federation keys", async () => {
      await seedCache(cache, ["federation-ipf", "federation-uspa-2024"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/ipf");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/uspa/2024");
    });

    it("should handle federation keys with hyphenated names and year", async () => {
      await seedCache(cache, ["federation-usa-pl-2020", "federation-all-russia"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/usa-pl/2020");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/all-russia");
    });

    it("should refresh meet keys", async () => {
      await seedCache(cache, ["meet-uspa/1969"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/m/uspa/1969");
    });

    it("should refresh user keys", async () => {
      await seedCache(cache, ["user-johnhaack"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/u/johnhaack");
    });

    it("should refresh records with filter path", async () => {
      await seedCache(cache, ["records/raw", "records/raw/men"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/raw");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/raw/men");
    });

    it("should skip internal cache keys", async () => {
      await seedCache(cache, ["hostname", "close-powerlifting-global-status-call-cache", "status"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
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
      const cron = createCron(cache, userRepository, mail, logger, scraper);
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

      const cron = createCron(cache, userRepository, mail, logger, scraper);
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
      await seedCache(cache, ["rankings-1-100"]);
      vi.mocked(scraper.fetchJson).mockRejectedValueOnce(new Error("API error"));

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh rankings-1-100",
        expect.any(Object),
      );
    });

    it("should handle missing text-content element", async () => {
      await seedCache(cache, ["status"]);
      vi.mocked(scraper.getElementByClass).mockReturnValueOnce(null);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
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

      const cron = createCron(cache, userRepository, mail, logger, scraper);
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
      const cron = createCron(cache, userRepository, mail, logger, scraper);
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
      await seedCache(cache, ["rankings-3-100"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      // page 3 with perPage 100: start = (3-1)*100 = 200, end = 300
      expect(scraper.fetchJson).toHaveBeenCalledWith(
        "/rankings?start=200&end=300&lang=en&units=lbs",
      );
    });

    it("should handle deep filter path rankings from prod", async () => {
      await seedCache(cache, ["rankings/raw/men/100/2024/full-power/by-dots-1-100"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchJson).toHaveBeenCalledWith(
        "/rankings/raw/men/100/2024/full-power/by-dots?start=0&end=100&lang=en&units=lbs",
      );
    });

    it("should handle rankings with small perPage", async () => {
      await seedCache(cache, ["rankings-1-9"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchJson).toHaveBeenCalledWith("/rankings?start=0&end=9&lang=en&units=lbs");
    });

    it("should warn on invalid rankings key format", async () => {
      await seedCache(cache, ["rankings-invalid"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: invalid rankings key format: rankings-invalid",
      );
    });

    it("should warn on rankings key with non-numeric page/perPage", async () => {
      await seedCache(cache, ["rankings-abc-def"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshCacheKey: invalid page/perPage in key: rankings-abc-def",
      );
    });

    // Edge cases for records
    it("should handle deep records filter paths from prod", async () => {
      await seedCache(cache, [
        "records/unlimited/para-classes/women",
        "records/raw/expanded-classes/men",
        "records/all-tested/women",
      ]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/unlimited/para-classes/women");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/raw/expanded-classes/men");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/records/all-tested/women");
    });

    // Edge cases for federations
    it("should not treat short numbers as years", async () => {
      // federation-365strong should NOT be parsed as year=365
      await seedCache(cache, ["federation-365strong"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/365strong");
    });

    it("should handle federation ending in 3 digit number", async () => {
      await seedCache(cache, ["federation-uspa-123"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      // 123 is not 4 digits, so it's part of the federation name
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/mlist/uspa-123");
    });

    // Edge cases for meets
    it("should handle meet codes with multiple path segments", async () => {
      await seedCache(cache, ["meet-wrpf-ru/2301", "meet-gpc/aus-vic/2023"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/m/wrpf-ru/2301");
      expect(scraper.fetchHtml).toHaveBeenCalledWith("/m/gpc/aus-vic/2023");
    });

    // Edge cases for users
    it("should handle user profile fetch failure", async () => {
      await seedCache(cache, ["user-nonexistent"]);
      vi.mocked(scraper.getElementByClass).mockReturnValueOnce(null);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh user-nonexistent",
        expect.objectContaining({ error: "User profile not found: nonexistent" }),
      );
    });

    it("should handle usernames with hyphens", async () => {
      await seedCache(cache, ["user-john-doe"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(scraper.fetchHtml).toHaveBeenCalledWith("/u/john-doe");
    });

    // Unknown key type
    it("should warn on unknown key types", async () => {
      await seedCache(cache, ["unknown-key-type"]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
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
        "user-johnhaack",
        "rankings-1-100",
      ]);
      const cron = createCron(cache, userRepository, mail, logger, scraper);
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

  describe("resetApiCallCount task", () => {
    it("should skip if not first day of month", async () => {
      vi.setSystemTime(new Date(2024, 0, 15)); // Jan 15

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "cron job skipped: resetApiCallCount (not start of month)",
      );
    });

    it("should reset counts on first day of month", async () => {
      vi.setSystemTime(new Date(2024, 0, 1)); // Jan 1

      const mockUsers = [{ email: "test@test.com", name: "Test" }];
      vi.mocked(userRepository.findVerified).mockResolvedValue(mockUsers as never);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.resetApiCallCount();

      expect(userRepository.resetAllApiCallCounts).toHaveBeenCalled();
      expect(mail.sendApiLimitResetEmail).toHaveBeenCalledWith({
        email: "test@test.com",
        name: "Test",
      });
    });

    it("should send emails to all verified users", async () => {
      vi.setSystemTime(new Date(2024, 0, 1));

      const mockUsers = [
        { email: "user1@test.com", name: "User 1" },
        { email: "user2@test.com", name: "User 2" },
        { email: "user3@test.com", name: "User 3" },
      ];
      vi.mocked(userRepository.findVerified).mockResolvedValue(mockUsers as never);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.resetApiCallCount();

      expect(mail.sendApiLimitResetEmail).toHaveBeenCalledTimes(3);
    });

    it("should handle findVerified error", async () => {
      vi.setSystemTime(new Date(2024, 0, 1));
      vi.mocked(userRepository.findVerified).mockRejectedValue(new Error("DB error"));

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.resetApiCallCount();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: resetApiCallCount",
        expect.any(Error),
      );
    });

    it("should handle resetAllApiCallCounts error", async () => {
      vi.setSystemTime(new Date(2024, 0, 1));
      vi.mocked(userRepository.findVerified).mockResolvedValue([
        { email: "a@b.com", name: "A" },
      ] as never);
      vi.mocked(userRepository.resetAllApiCallCounts).mockRejectedValue(new Error("DB error"));

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.resetApiCallCount();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: resetApiCallCount",
        expect.any(Error),
      );
    });

    it("should log completion on success", async () => {
      vi.setSystemTime(new Date(2024, 0, 1));
      vi.mocked(userRepository.findVerified).mockResolvedValue([]);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.resetApiCallCount();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: resetApiCallCount");
    });
  });

  describe("sendReachingApiLimitEmail task", () => {
    it("should send emails to users at 70% limit", async () => {
      const mockUsers = [{ email: "user@test.com", name: "User" }];
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue(mockUsers as never);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).toHaveBeenCalledWith({
        email: "user@test.com",
        name: "User",
        percent: 70,
      });
    });

    it("should not send emails if no users at limit", async () => {
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue([]);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).not.toHaveBeenCalled();
    });

    it("should send emails to all users at limit", async () => {
      const mockUsers = [
        { email: "user1@test.com", name: "User 1" },
        { email: "user2@test.com", name: "User 2" },
      ];
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue(mockUsers as never);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.sendReachingApiLimitEmail();

      expect(mail.sendReachingApiLimitEmail).toHaveBeenCalledTimes(2);
    });

    it("should handle findByApiCallCount error", async () => {
      vi.mocked(userRepository.findByApiCallCount).mockRejectedValue(new Error("DB error"));

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.sendReachingApiLimitEmail();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: sendReachingApiLimitEmail",
        expect.any(Error),
      );
    });

    it("should log completion on success", async () => {
      vi.mocked(userRepository.findByApiCallCount).mockResolvedValue([]);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.sendReachingApiLimitEmail();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: sendReachingApiLimitEmail");
    });
  });
});
