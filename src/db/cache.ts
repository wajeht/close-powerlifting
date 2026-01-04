import type { Knex } from "knex";
import type { LoggerType } from "../utils/logger";

type CacheEntry = {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
};

export interface CacheType {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
  delPattern: (pattern: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  clearAll: () => Promise<void>;
  isReady: () => boolean;
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

  return {
    get,
    set,
    del,
    delPattern,
    keys,
    clearAll,
    isReady,
  };
}
