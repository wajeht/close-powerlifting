import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
import { buildPagination } from "../../utils/helpers";
import { createMiddleware } from "../middleware";

export function createDashboardRouter(context: AppContext) {
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

  router.get(
    "/",
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

      const usagePercent = Math.round((user.api_call_count / user.api_call_limit) * 100);

      const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1;
      const search = (req.query.search as string) || "";
      const limit = 10;

      const totalCalls = await context.apiCallLogRepository.countByUserId(
        sessionUser.id,
        search || undefined,
      );
      const callsPagination = buildPagination(totalCalls, page, limit);
      const offset = (callsPagination.current_page - 1) * limit;

      const recentCalls = await context.apiCallLogRepository.findByUserId(sessionUser.id, {
        search: search || undefined,
        limit,
        offset,
        orderBy: "created_at",
        order: "desc",
      });

      let stats = null;
      if (user.admin) {
        const allUsers = await context.userRepository.findAll();
        const cacheStats = await context.cache.getStatistics();
        stats = {
          totalUsers: allUsers.length,
          verifiedUsers: allUsers.filter((u) => u.verified).length,
          unverifiedUsers: allUsers.filter((u) => !u.verified).length,
          adminUsers: allUsers.filter((u) => u.admin).length,
          cacheEntries: cacheStats.totalEntries,
          totalApiCalls: allUsers.reduce((sum, u) => sum + u.api_call_count, 0),
        };
      }

      return res.render("dashboard/dashboard.html", {
        title: "Dashboard",
        path: "/dashboard",
        user,
        usagePercent,
        recentCalls,
        callsPagination,
        search,
        stats,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  return router;
}
