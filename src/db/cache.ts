import type { Knex } from "knex";
import type { LoggerType } from "../utils/logger";

export interface CacheEntry {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface CacheStatistics {
  totalEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  keyPatterns: { pattern: string; count: number }[];
}

export interface GetEntriesOptions {
  pattern?: string;
  orderBy?: keyof CacheEntry;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface CacheType {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
  delPattern: (pattern: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  clearAll: () => Promise<void>;
  isReady: () => boolean;
  getStatistics: () => Promise<CacheStatistics>;
  getEntries: (options?: GetEntriesOptions) => Promise<CacheEntry[]>;
  countEntries: (pattern?: string) => Promise<number>;
}

export function createCache(knex: Knex, logger: LoggerType): CacheType {
  async function get(key: string): Promise<string | null> {
    const entry = await knex<CacheEntry>("cache").where({ key }).first();
    return entry?.value ?? null;
  }

  async function set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await knex<CacheEntry>("cache").where({ key }).first();

    if (existing) {
      await knex<CacheEntry>("cache").where({ key }).update({
        value,
        updated_at: now,
      });
    } else {
      await knex<CacheEntry>("cache").insert({
        key,
        value,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async function del(key: string): Promise<void> {
    await knex<CacheEntry>("cache").where({ key }).delete();
  }

  async function delPattern(pattern: string): Promise<number> {
    const result = await knex<CacheEntry>("cache").where("key", "like", pattern).delete();
    return result;
  }

  async function keys(pattern: string): Promise<string[]> {
    const entries = await knex<CacheEntry>("cache").where("key", "like", pattern).select("key");
    return entries.map((e) => e.key);
  }

  async function clearAll(): Promise<void> {
    await knex<CacheEntry>("cache").delete();
    logger.info("Cleared all cache entries");
  }

  function isReady(): boolean {
    return knex !== null;
  }

  async function getStatistics(): Promise<CacheStatistics> {
    const entries = await knex<CacheEntry>("cache").select("key", "created_at", "updated_at");

    const keyPatterns = new Map<string, number>();
    for (const entry of entries) {
      const prefix = entry.key.split("-")[0] || "other";
      keyPatterns.set(prefix, (keyPatterns.get(prefix) || 0) + 1);
    }

    let oldestEntry: string | null = null;
    let newestEntry: string | null = null;

    if (entries.length > 0) {
      oldestEntry = entries.reduce((a, b) => (a.created_at < b.created_at ? a : b)).created_at;
      newestEntry = entries.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)).updated_at;
    }

    return {
      totalEntries: entries.length,
      oldestEntry,
      newestEntry,
      keyPatterns: Array.from(keyPatterns.entries()).map(([pattern, count]) => ({
        pattern,
        count,
      })),
    };
  }

  async function getEntries(options: GetEntriesOptions = {}): Promise<CacheEntry[]> {
    const pattern = options.pattern || "%";

    let query = knex<CacheEntry>("cache").where("key", "like", pattern).select("*");
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || "asc");
    }
    if (options.limit != null) {
      query = query.limit(options.limit);
    }
    if (options.offset != null) {
      query = query.offset(options.offset);
    }
    return query;
  }

  async function countEntries(pattern: string = "%"): Promise<number> {
    const result = await knex<CacheEntry>("cache")
      .where("key", "like", pattern)
      .count("* as count")
      .first<{ count: number }>();
    return Number(result?.count || 0);
  }

  return {
    get,
    set,
    del,
    delPattern,
    keys,
    clearAll,
    isReady,
    getStatistics,
    getEntries,
    countEntries,
  };
}
