import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCron } from "./cron";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { MailType } from "./mail";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";

// Simple in-memory cache for testing
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
      return Array.from(store.keys()).filter((k) => k.includes(pattern.replace(/%/g, "")));
    },
    clearAll: async () => {
      store.clear();
    },
    isReady: () => true,
  };
}

// Simple logger for testing
function createTestLogger(): LoggerType {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as LoggerType;
}

// Simple scraper for testing
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
    it("should cache status data", async () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached = await cache.get("status");
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!)).toHaveProperty("server_version");
    });

    it("should cache federations list", async () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached = await cache.get("federations-list");
      expect(cached).not.toBeNull();
    });

    it("should cache records", async () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      const cached = await cache.get("records");
      expect(cached).not.toBeNull();
    });

    it("should cache rankings pages 1-10", async () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      for (let i = 1; i <= 10; i++) {
        const cached = await cache.get(`rankings-${i}-100`);
        expect(cached).not.toBeNull();
      }
    });

    it("should log completion with results summary", async () => {
      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 13,
          successful: 13,
          failed: 0,
        }),
      );
    });

    it("should handle fetchHtml errors and continue", async () => {
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

    it("should handle fetchJson errors and continue", async () => {
      vi.mocked(scraper.fetchJson).mockRejectedValueOnce(new Error("API error"));

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh rankings-page-1",
        expect.any(Object),
      );
    });

    it("should handle missing text-content element", async () => {
      vi.mocked(scraper.getElementByClass).mockReturnValueOnce(null);

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.error).toHaveBeenCalledWith(
        "refreshCache: failed to refresh status",
        expect.objectContaining({ error: "Could not find text-content element on status page" }),
      );
    });

    it("should report partial failures in summary", async () => {
      vi.mocked(scraper.fetchHtml)
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValue("<html></html>");

      const cron = createCron(cache, userRepository, mail, logger, scraper);
      await cron.tasks.refreshCache();

      expect(logger.info).toHaveBeenCalledWith(
        "cron job completed: refreshCache",
        expect.objectContaining({
          total: 13,
          successful: 11,
          failed: 2,
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
