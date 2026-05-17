import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
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
        const allUsers = await context.userRepository.findAll();
        const cacheStats = await context.cache.getStatistics();
        stats = {
          totalUsers: allUsers.length,
          verifiedUsers: allUsers.filter((u) => u.verified).length,
          unverifiedUsers: allUsers.filter((u) => !u.verified).length,
          adminUsers: allUsers.filter((u) => u.admin).length,
          cacheEntries: cacheStats.totalEntries,
        };
      }

      return res.render("dashboard/dashboard.html", {
        title: "Dashboard",
        path: "/dashboard",
        user,
        stats,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  return router;
}
