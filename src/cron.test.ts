import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createCron } from "./cron";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { LoggerType } from "./utils/logger";
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

describe("cron", () => {
  let cache: CacheType;
  let logger: LoggerType;
  let userRepository: UserRepositoryType;
  let ingest: IngestServiceType;

  beforeEach(() => {
    cache = createTestCache();
    logger = createTestLogger();
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
      const cron = createCron(cache, userRepository, logger, ingest);

      expect(cron).toHaveProperty("start");
      expect(cron).toHaveProperty("stop");
      expect(cron).toHaveProperty("getStatus");
      expect(cron).toHaveProperty("tasks");
    });

    it("should return not running status initially", () => {
      const cron = createCron(cache, userRepository, logger, ingest);

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should update status after start", () => {
      const cron = createCron(cache, userRepository, logger, ingest);
      cron.start();

      const status = cron.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.jobCount).toBe(2);

      cron.stop();
    });

    it("should update status after stop", () => {
      const cron = createCron(cache, userRepository, logger, ingest);
      cron.start();
      cron.stop();

      expect(cron.getStatus()).toEqual({ isRunning: false, jobCount: 0 });
    });

    it("should log when started and stopped", () => {
      const cron = createCron(cache, userRepository, logger, ingest);
      cron.start();

      expect(logger.info).toHaveBeenCalledWith("cron service started", { jobs: 2 });

      cron.stop();

      expect(logger.info).toHaveBeenCalledWith("cron service stopped");
    });
  });

  describe("refreshHealthCheck task", () => {
    it("should skip when hostname is not cached", async () => {
      const cron = createCron(cache, userRepository, logger, ingest);
      await cron.tasks.refreshHealthCheck();

      expect(logger.warn).toHaveBeenCalledWith(
        "refreshHealthCheck: hostname not cached yet, skipping",
      );
    });

    it("should skip when admin user is not found", async () => {
      await cache.set("hostname", "http://localhost");

      const cron = createCron(cache, userRepository, logger, ingest);
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

      const cron = createCron(cache, userRepository, logger, ingest);
      await cron.tasks.refreshHealthCheck();

      expect(logger.info).toHaveBeenCalledWith("cron job completed: refreshHealthCheck");
    });

    it("should log error on failure", async () => {
      await cache.set("hostname", "http://localhost");
      vi.mocked(userRepository.findByEmail).mockRejectedValueOnce(new Error("db error"));

      const cron = createCron(cache, userRepository, logger, ingest);
      await cron.tasks.refreshHealthCheck();

      expect(logger.error).toHaveBeenCalledWith(
        "cron job failed: refreshHealthCheck",
        expect.any(Error),
      );
    });
  });
});
