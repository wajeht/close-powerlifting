import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { createMiddleware } from "../../middleware";

/**
 * Quota information
 * @typedef {object} QuotaData
 * @property {number} limit - Monthly API call limit (null for unlimited accounts)
 * @property {number} used - API calls used in the current period
 * @property {number} remaining - API calls remaining in the current period (null for unlimited accounts)
 * @property {string} reset_at - ISO timestamp of the next scheduled reset (start of the next UTC month)
 */

/**
 * Quota response
 * @typedef {object} QuotaResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {QuotaData} data - Quota information
 */

export function createQuotaRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
    context.apiCallLogRepository,
  );

  const router = express.Router();

  /**
   * GET /api/quota
   * @tags Quota
   * @summary Check current API quota usage
   * @description Returns the authenticated user's monthly API call quota: limit, used, remaining, and the next reset time. This endpoint does not count against the quota.
   * @security BearerAuth
   * @return {QuotaResponse} 200 - Quota information
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/quota",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "limit": 750,
   *     "used": 60,
   *     "remaining": 690,
   *     "reset_at": "2026-06-01T00:00:00.000Z"
   *   }
   * }
   */
  router.get(
    "/api/quota",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.apiCacheControlMiddleware,
    async (req: Request, res: Response) => {
      const user = await context.userRepository.findById(req.user.id);

      if (!user) {
        return res.status(401).json({
          status: "fail",
          request_url: req.originalUrl,
          message: "User not found",
          errors: [],
          data: [],
        });
      }

      const now = new Date();
      const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      return res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: {
          limit: user.admin ? null : user.api_call_limit,
          used: user.api_call_count,
          remaining: user.admin ? null : Math.max(0, user.api_call_limit - user.api_call_count),
          reset_at: resetAt.toISOString(),
        },
      });
    },
  );

  return router;
}
