import { describe, expect, beforeEach, afterEach, it } from "vitest";

import { knex, logger } from "../tests/test-setup";
import { createCache } from "./cache";

describe("Cache", () => {
  const cache = createCache(knex, logger);

  describe("getEntries", () => {
    beforeEach(async () => {
      await knex("cache").insert([
        {
          key: "test-old-entry",
          value: "value1",
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
        {
          key: "test-newest-entry",
          value: "value2",
          created_at: "2024-06-01T00:00:00.000Z",
          updated_at: "2024-06-01T00:00:00.000Z",
        },
        {
          key: "test-middle-entry",
          value: "value3",
          created_at: "2024-03-01T00:00:00.000Z",
          updated_at: "2024-03-01T00:00:00.000Z",
        },
      ]);
    });

    afterEach(async () => {
      await knex("cache").where("key", "like", "test-%").delete();
    });

    it("should return entries ordered by field asc", async () => {
      const entries = await cache.getEntries({
        pattern: "test-%",
        orderBy: "updated_at",
        order: "asc",
      });

      expect(entries[0].key).toBe("test-old-entry");
      expect(entries[1].key).toBe("test-middle-entry");
      expect(entries[2].key).toBe("test-newest-entry");
    });

    it("should return entries ordered by field desc", async () => {
      const entries = await cache.getEntries({
        pattern: "test-%",
        orderBy: "updated_at",
        order: "desc",
      });

      expect(entries[0].key).toBe("test-newest-entry");
      expect(entries[1].key).toBe("test-middle-entry");
      expect(entries[2].key).toBe("test-old-entry");
    });

    it("should respect limit and offset", async () => {
      const entries = await cache.getEntries({
        pattern: "test-%",
        orderBy: "updated_at",
        order: "desc",
        limit: 2,
        offset: 0,
      });

      expect(entries.length).toBe(2);
      expect(entries[0].key).toBe("test-newest-entry");
      expect(entries[1].key).toBe("test-middle-entry");
    });

    it("should handle offset correctly", async () => {
      const entries = await cache.getEntries({
        pattern: "test-%",
        orderBy: "updated_at",
        order: "desc",
        limit: 2,
        offset: 1,
      });

      expect(entries.length).toBe(2);
      expect(entries[0].key).toBe("test-middle-entry");
      expect(entries[1].key).toBe("test-old-entry");
    });
  });

  describe("countEntries", () => {
    beforeEach(async () => {
      await knex("cache").insert([
        {
          key: "count-test-1",
          value: "value1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          key: "count-test-2",
          value: "value2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          key: "other-entry",
          value: "value3",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    });

    afterEach(async () => {
      await knex("cache").where("key", "like", "count-test-%").delete();
      await knex("cache").where("key", "=", "other-entry").delete();
    });

    it("should return total count with pattern", async () => {
      const count = await cache.countEntries("count-test-%");
      expect(count).toBe(2);
    });

    it("should return count for all entries with default pattern", async () => {
      const count = await cache.countEntries();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("should return 0 for non-matching pattern", async () => {
      const count = await cache.countEntries("nonexistent-%");
      expect(count).toBe(0);
    });
  });
});
