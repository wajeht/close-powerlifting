import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";

export function createDashboardRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.apiCallLogRepository,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
  );

  const router = express.Router();

  router.get(
    "/dashboard",
    middleware.sessionAuthenticationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;
      const user = await context.userRepository.findById(sessionUser.id);

      if (!user) {
        req.session.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      let stats = null;
      if (user.admin) {
        const [allUsers, cacheStats, totalApiCalls] = await Promise.all([
          context.userRepository.findAll(),
          context.cache.getStatistics(),
          context.apiCallLogRepository.countAll(),
        ]);
        stats = {
          totalUsers: allUsers.length,
          verifiedUsers: allUsers.filter((u) => u.verified).length,
          unverifiedUsers: allUsers.filter((u) => !u.verified).length,
          adminUsers: allUsers.filter((u) => u.admin).length,
          cacheEntries: cacheStats.totalEntries,
          totalApiCalls,
        };
      }

      const recentCalls = await context.apiCallLogRepository.findByUserId(user.id, { limit: 10 });
      const now = Date.now();
      const last24hSince = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const last30dSince = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [totalCalls, callsLast24h, callsLast30d] = await Promise.all([
        context.apiCallLogRepository.countByUserId(user.id),
        context.apiCallLogRepository.countByUserIdSince(user.id, last24hSince),
        context.apiCallLogRepository.countByUserIdSince(user.id, last30dSince),
      ]);

      return res.render("dashboard/dashboard.html", {
        title: "Dashboard",
        path: "/dashboard",
        user,
        stats,
        recentCalls,
        totalCalls,
        callsLast24h,
        callsLast30d,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  return router;
}
