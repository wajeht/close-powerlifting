import type { CacheType, CacheEntry } from "../../db/cache";
import type { UserRepositoryType } from "../../db/user";
import type { ApiCallLogRepositoryType } from "../../db/api-call-log";
import type { AuthServiceType } from "../auth/auth.service";
import type { User, Pagination, ApiCallLog } from "../../types";
import type { LoggerType } from "../../utils/logger";

export interface AdminServiceType {
  getAllUsers: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    order?: "asc" | "desc";
  }) => Promise<{ users: User[]; pagination: Pagination }>;
  getUserById: (id: number) => Promise<User | undefined>;
  getUserApiCallHistory: (
    userId: number,
    options?: { page?: number; limit?: number; search?: string },
  ) => Promise<{ calls: ApiCallLog[]; pagination: Pagination }>;
  updateUserApiCallCount: (userId: number, count: number) => Promise<User | undefined>;
  updateUserApiCallLimit: (userId: number, limit: number) => Promise<User | undefined>;
  resendVerificationEmail: (userId: number, hostname: string) => Promise<boolean>;
  getCacheEntries: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    order?: "asc" | "desc";
  }) => Promise<{ entries: CacheEntry[]; pagination: Pagination }>;
  clearAllCache: () => Promise<void>;
  deleteCacheEntry: (key: string) => Promise<void>;
  getDashboardStats: () => Promise<DashboardStats>;
}

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  adminUsers: number;
  cacheEntries: number;
  totalApiCalls: number;
}

function buildPagination(total: number, page: number, limit: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * limit;

  return {
    items: total,
    pages: totalPages,
    per_page: limit,
    current_page: currentPage,
    last_page: totalPages,
    first_page: 1,
    from: total > 0 ? offset + 1 : 0,
    to: Math.min(offset + limit, total),
  };
}

export function createAdminService(
  userRepository: UserRepositoryType,
  cache: CacheType,
  authService: AuthServiceType,
  logger: LoggerType,
  apiCallLogRepository: ApiCallLogRepositoryType,
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

  async function getUserApiCallHistory(
    userId: number,
    options: { page?: number; limit?: number; search?: string } = {},
  ): Promise<{ calls: ApiCallLog[]; pagination: Pagination }> {
    const limit = options.limit || 10;

    const total = await apiCallLogRepository.countByUserId(userId, options.search);
    const pagination = buildPagination(total, options.page || 1, limit);
    const offset = (pagination.current_page - 1) * limit;

    const calls = await apiCallLogRepository.findByUserId(userId, {
      search: options.search,
      orderBy: "created_at",
      order: "desc",
      limit,
      offset,
    });

    return { calls, pagination };
  }

  async function updateUserApiCallCount(userId: number, count: number): Promise<User | undefined> {
    return userRepository.setApiCallCount(userId, count);
  }

  async function updateUserApiCallLimit(userId: number, limit: number): Promise<User | undefined> {
    return userRepository.updateById(userId, { api_call_limit: limit });
  }

  async function resendVerificationEmail(userId: number, hostname: string): Promise<boolean> {
    const user = await userRepository.findById(userId);

    if (!user || user.verified || !user.verification_token) {
      return false;
    }

    await authService.sendVerificationEmail({
      hostname,
      name: user.name,
      email: user.email,
      verification_token: user.verification_token,
    });

    logger.info(`Admin resent verification email to user ${user.id} (${user.email})`);

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

  async function getDashboardStats(): Promise<DashboardStats> {
    const allUsers = await userRepository.findAll();
    const cacheStats = await cache.getStatistics();

    const verifiedUsers = allUsers.filter((u) => u.verified).length;
    const adminUsers = allUsers.filter((u) => u.admin).length;
    const totalApiCalls = allUsers.reduce((sum, u) => sum + u.api_call_count, 0);

    return {
      totalUsers: allUsers.length,
      verifiedUsers,
      unverifiedUsers: allUsers.length - verifiedUsers,
      adminUsers,
      cacheEntries: cacheStats.totalEntries,
      totalApiCalls,
    };
  }

  return {
    getAllUsers,
    getUserById,
    getUserApiCallHistory,
    updateUserApiCallCount,
    updateUserApiCallLimit,
    resendVerificationEmail,
    getCacheEntries,
    clearAllCache,
    deleteCacheEntry,
    getDashboardStats,
  };
}
