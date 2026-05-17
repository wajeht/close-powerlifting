import type { Knex } from "knex";

import type { CacheType, CacheEntry } from "../../db/cache";
import type { UserRepositoryType } from "../../db/user";
import type { AuthServiceType } from "../auth/auth.service";
import type { User, Pagination } from "../../types";
import type { LoggerType } from "../../utils/logger";
import type { HelpersType } from "../../utils/helpers";
import { buildPagination } from "../../utils/helpers";

const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface IngestRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  lifter_count: number | null;
  meet_count: number | null;
  federation_count: number | null;
  lift_count: number | null;
  byte_size: number | null;
  source_last_modified: string | null;
  status: "completed" | "skipped" | "failed";
  error: string | null;
}

export interface AdminServiceType {
  getAllUsers: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    order?: "asc" | "desc";
  }) => Promise<{ users: User[]; pagination: Pagination }>;
  getUserById: (id: number) => Promise<User | undefined>;
  resendVerificationEmail: (userId: number, hostname: string) => Promise<boolean>;
  deleteUser: (userId: number) => Promise<boolean>;
  getCacheEntries: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    order?: "asc" | "desc";
  }) => Promise<{ entries: CacheEntry[]; pagination: Pagination }>;
  clearAllCache: () => Promise<void>;
  deleteCacheEntry: (key: string) => Promise<void>;
  getIngestRuns: (options?: {
    page?: number;
    limit?: number;
  }) => Promise<{ runs: IngestRunRow[]; pagination: Pagination }>;
  getDashboardStats: () => Promise<DashboardStats>;
}

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  adminUsers: number;
  cacheEntries: number;
}

export function createAdminService(
  knex: Knex,
  userRepository: UserRepositoryType,
  cache: CacheType,
  authService: AuthServiceType,
  logger: LoggerType,
  helpers: HelpersType,
): AdminServiceType {
  async function getAllUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      order?: "asc" | "desc";
    } = {},
  ): Promise<{ users: User[]; pagination: Pagination }> {
    const limit = options.limit || 10;
    const order = options.order || "desc";

    const total = await userRepository.count({}, options.search);
    const pagination = buildPagination(total, options.page || 1, limit);
    const offset = (pagination.current_page - 1) * limit;

    const users = await userRepository.findAll({
      search: options.search,
      orderBy: "created_at",
      order,
      limit,
      offset,
    });

    return { users, pagination };
  }

  async function getUserById(id: number): Promise<User | undefined> {
    return userRepository.findById(id);
  }

  async function resendVerificationEmail(userId: number, hostname: string): Promise<boolean> {
    const user = await userRepository.findById(userId);

    if (!user || user.verified) {
      return false;
    }

    const newToken = helpers.generateToken();
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS).toISOString();

    await userRepository.updateById(user.id, {
      verification_token: newToken,
      magic_link_expires_at: verificationExpiresAt,
    });

    void authService
      .sendVerificationEmail({
        hostname,
        name: user.name,
        email: user.email,
        verification_token: newToken,
      })
      .catch((error) => {
        logger.error("Admin failed to resend verification email", {
          userId: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    logger.info(`Admin queued verification email to user ${user.id} (${user.email})`);

    return true;
  }

  async function deleteUser(userId: number): Promise<boolean> {
    const user = await userRepository.findById(userId);

    if (!user) {
      return false;
    }

    await userRepository.delete(userId);
    logger.info(`Admin deleted user ${user.id} (${user.email})`);

    return true;
  }

  async function getCacheEntries(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      order?: "asc" | "desc";
    } = {},
  ): Promise<{ entries: CacheEntry[]; pagination: Pagination }> {
    const limit = options.limit || 10;
    const order = options.order || "desc";
    const pattern = options.search ? `%${options.search}%` : "%";

    const total = await cache.countEntries(pattern);
    const pagination = buildPagination(total, options.page || 1, limit);
    const offset = (pagination.current_page - 1) * limit;

    const entries = await cache.getEntries({
      pattern,
      orderBy: "updated_at",
      order,
      limit,
      offset,
    });

    return { entries, pagination };
  }

  async function clearAllCache(): Promise<void> {
    await cache.clearAll();
    logger.info("Admin cleared all cache entries");
  }

  async function deleteCacheEntry(key: string): Promise<void> {
    await cache.del(key);
    logger.info(`Admin deleted cache entry: ${key}`);
  }

  async function getIngestRuns(
    options: { page?: number; limit?: number } = {},
  ): Promise<{ runs: IngestRunRow[]; pagination: Pagination }> {
    const limit = options.limit ?? 25;
    const countRow = await knex("ingest_runs")
      .count<{ total: number | string }[]>({ total: "id" })
      .first();
    const total = Number(countRow?.total ?? 0);

    const pagination = buildPagination(total, options.page ?? 1, limit);
    const offset = (pagination.current_page - 1) * limit;

    const runs = (await knex("ingest_runs")
      .select<IngestRunRow[]>("*")
      .orderBy("id", "desc")
      .limit(limit)
      .offset(offset)) as IngestRunRow[];

    return { runs, pagination };
  }

  async function getDashboardStats(): Promise<DashboardStats> {
    const allUsers = await userRepository.findAll();
    const cacheStats = await cache.getStatistics();

    const verifiedUsers = allUsers.filter((u) => u.verified).length;
    const adminUsers = allUsers.filter((u) => u.admin).length;

    return {
      totalUsers: allUsers.length,
      verifiedUsers,
      unverifiedUsers: allUsers.length - verifiedUsers,
      adminUsers,
      cacheEntries: cacheStats.totalEntries,
    };
  }

  return {
    getAllUsers,
    getUserById,
    resendVerificationEmail,
    deleteUser,
    getCacheEntries,
    clearAllCache,
    deleteCacheEntry,
    getIngestRuns,
    getDashboardStats,
  };
}
