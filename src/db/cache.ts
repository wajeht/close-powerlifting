import type { Knex } from "knex";
import type { LoggerType } from "../utils/logger";

type CacheEntry = {
  key: string;
  value: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface CacheType {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  delPattern: (pattern: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  clearExpired: () => Promise<number>;
  clearAll: () => Promise<void>;
  isReady: () => boolean;
}

export function createCache(knex: Knex, logger: LoggerType): CacheType {
  async function get(key: string): Promise<string | null> {
    const entry = await knex<CacheEntry>("cache").where({ key }).first();

    if (!entry) {
      return null;
    }

    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      await del(key);
      return null;
    }

    return entry.value;
  }

  async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const now = new Date().toISOString();
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;

    const existing = await knex<CacheEntry>("cache").where({ key }).first();

    if (existing) {
      await knex<CacheEntry>("cache").where({ key }).update({
        value,
        expires_at: expiresAt,
        updated_at: now,
      });
    } else {
      await knex<CacheEntry>("cache").insert({
        key,
        value,
        expires_at: expiresAt,
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

  async function clearExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await knex<CacheEntry>("cache")
      .whereNotNull("expires_at")
      .where("expires_at", "<", now)
      .delete();
    logger.info(`Cleared ${result} expired cache entries`);
    return result;
  }

  async function clearAll(): Promise<void> {
    await knex<CacheEntry>("cache").delete();
    logger.info("Cleared all cache entries");
  }

  function isReady(): boolean {
    return knex !== null;
  }

  return {
    get,
    set,
    del,
    delPattern,
    keys,
    clearExpired,
    clearAll,
    isReady,
  };
}
