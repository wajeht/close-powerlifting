import type { CacheType, CacheEntry } from "../../db/cache";
import type { UserRepositoryType } from "../../db/user";
import type { AuthServiceType } from "../auth/auth.service";
import type { User, Pagination } from "../../types";
import type { LoggerType } from "../../utils/logger";

export interface AdminServiceType {
  getAllUsers: (options?: {
    page?: number;
    limit?: number;
    search?: string;
  }) => Promise<{ users: User[]; pagination: Pagination }>;
  getUserById: (id: number) => Promise<User | undefined>;
  updateUserApiCallCount: (userId: number, count: number) => Promise<User | undefined>;
  updateUserApiCallLimit: (userId: number, limit: number) => Promise<User | undefined>;
  resendVerificationEmail: (userId: number, hostname: string) => Promise<boolean>;
  getCacheEntries: (pattern: string) => Promise<CacheEntry[]>;
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

export function createAdminService(
  userRepository: UserRepositoryType,
  cache: CacheType,
  authService: AuthServiceType,
  logger: LoggerType,
): AdminServiceType {
  async function getAllUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ): Promise<{ users: User[]; pagination: Pagination }> {
    const limit = options.limit || 20;

    let allUsers = await userRepository.findAll();

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      allUsers = allUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower),
      );
    }

    const total = allUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(1, options.page || 1), totalPages);
    const offset = (page - 1) * limit;
    const users = allUsers.slice(offset, offset + limit);

    return {
      users,
      pagination: {
        items: total,
        pages: totalPages,
        per_page: limit,
        current_page: page,
        last_page: totalPages,
        first_page: 1,
        from: offset + 1,
        to: Math.min(offset + limit, total),
      },
    };
  }

  async function getUserById(id: number): Promise<User | undefined> {
    return userRepository.findById(id);
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

  async function getCacheEntries(pattern: string): Promise<CacheEntry[]> {
    return cache.getEntries(pattern);
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
    updateUserApiCallCount,
    updateUserApiCallLimit,
    resendVerificationEmail,
    getCacheEntries,
    clearAllCache,
    deleteCacheEntry,
    getDashboardStats,
  };
}
