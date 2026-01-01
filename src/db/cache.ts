import { getDb } from "./db";
import { logger } from "../utils/logger";

type CacheEntry = {
  key: string;
  value: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Get a value from the cache
 */
export async function get(key: string): Promise<string | null> {
  const db = getDb();
  const entry = await db<CacheEntry>("cache").where({ key }).first();

  if (!entry) {
    return null;
  }

  // Check if expired
  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    await del(key);
    return null;
  }

  return entry.value;
}

/**
 * Set a value in the cache
 * @param ttlSeconds Optional time-to-live in seconds
 */
export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;

  const existing = await db<CacheEntry>("cache").where({ key }).first();

  if (existing) {
    await db<CacheEntry>("cache").where({ key }).update({
      value,
      expires_at: expiresAt,
      updated_at: now,
    });
  } else {
    await db<CacheEntry>("cache").insert({
      key,
      value,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    });
  }
}

/**
 * Delete a key from the cache
 */
export async function del(key: string): Promise<void> {
  const db = getDb();
  await db<CacheEntry>("cache").where({ key }).delete();
}

/**
 * Delete all keys matching a pattern (uses SQL LIKE)
 * Pattern uses SQL wildcards: % for any characters, _ for single character
 */
export async function delPattern(pattern: string): Promise<number> {
  const db = getDb();
  const result = await db<CacheEntry>("cache").where("key", "like", pattern).delete();
  return result;
}

/**
 * Get all keys matching a pattern
 */
export async function keys(pattern: string): Promise<string[]> {
  const db = getDb();
  const entries = await db<CacheEntry>("cache").where("key", "like", pattern).select("key");
  return entries.map((e) => e.key);
}

/**
 * Clear all expired entries from the cache
 */
export async function clearExpired(): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db<CacheEntry>("cache")
    .whereNotNull("expires_at")
    .where("expires_at", "<", now)
    .delete();
  logger.info(`Cleared ${result} expired cache entries`);
  return result;
}

/**
 * Clear all cache entries
 */
export async function clearAll(): Promise<void> {
  const db = getDb();
  await db<CacheEntry>("cache").delete();
  logger.info("Cleared all cache entries");
}

/**
 * Check connection status (for health checks)
 */
export function isReady(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

export const cache = {
  get,
  set,
  del,
  delPattern,
  keys,
  clearExpired,
  clearAll,
  isReady,
};
