import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
import { INTERNAL_CACHE_KEYS } from "../../cron";
import { createMiddleware } from "../middleware";
import { createAdminService } from "./admin.service";
import {
  userIdParamValidation,
  usersQueryValidation,
  cacheKeyValidation,
  cacheQueryValidation,
} from "./admin.validation";

export function createAdminRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
  );

  const adminService = createAdminService(
    context.userRepository,
    context.cache,
    context.authService,
    context.logger,
    context.helpers,
  );

  const router = express.Router();

  router.get(
    "/admin",
    middleware.sessionAdminAuthenticationMiddleware,
    (_req: Request, res: Response) => {
      return res.redirect("/dashboard");
    },
  );

  router.get(
    "/admin/users",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.validationMiddleware({ query: usersQueryValidation }),
    async (req: Request, res: Response) => {
      const page = req.query.page as number | undefined;
      const search = req.query.search as string | undefined;

      const { users, pagination } = await adminService.getAllUsers({
        page,
        search,
      });

      return res.render("admin/users-list.html", {
        title: "Manage Users",
        path: "/admin/users",
        users,
        pagination,
        search: search || "",
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/admin/users/:id/resend-verification",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ params: userIdParamValidation }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;
      const hostname = context.helpers.getHostName(req);

      const success = await adminService.resendVerificationEmail(id, hostname);

      if (!success) {
        req.flash("error", "Could not resend verification email");
      } else {
        req.flash("success", "Verification email sent");
      }
      return res.redirect("/admin/users");
    },
  );

  router.post(
    "/admin/users/:id/delete",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ params: userIdParamValidation }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;

      if (req.session?.user?.id === id) {
        req.flash("error", "You cannot delete your own account");
        return res.redirect("/admin/users");
      }

      const success = await adminService.deleteUser(id);

      if (!success) {
        req.flash("error", "User not found");
      } else {
        req.flash("success", "User deleted");
      }
      return res.redirect("/admin/users");
    },
  );

  router.get(
    "/admin/users/:id",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.validationMiddleware({ params: userIdParamValidation }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;

      const user = await adminService.getUserById(id);
      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/admin/users");
      }

      return res.render("admin/user-details.html", {
        title: `User: ${user.name}`,
        path: "/admin/users",
        viewedUser: user,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.get(
    "/admin/cache",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.validationMiddleware({ query: cacheQueryValidation }),
    async (req: Request, res: Response) => {
      const page = req.query.page as number | undefined;
      const search = req.query.search as string | undefined;

      const { entries, pagination } = await adminService.getCacheEntries({
        page,
        search,
      });

      return res.render("admin/cache-view.html", {
        title: "Cache Management",
        path: "/admin/cache",
        entries,
        pagination,
        search: search || "",
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/admin/cache/clear",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      await adminService.clearAllCache();

      req.flash("success", "All cache entries cleared");
      return res.redirect("/admin/cache");
    },
  );

  router.post(
    "/admin/cache/delete",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ body: cacheKeyValidation }),
    async (req: Request, res: Response) => {
      const key = req.body.key as string;

      await adminService.deleteCacheEntry(key);

      req.flash("success", `Deleted cache entry "${key}"`);
      return res.redirect("/admin/cache");
    },
  );

  router.post(
    "/admin/cache/refresh",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ body: cacheKeyValidation }),
    async (req: Request, res: Response) => {
      const key = req.body.key as string;

      if (INTERNAL_CACHE_KEYS.includes(key)) {
        req.flash("error", `Cache entry "${key}" is managed internally and cannot be refreshed`);
        return res.redirect("/admin/cache");
      }

      try {
        await context.cron.tasks.refreshCacheKey(key);
        req.flash("success", `Refreshed cache entry "${key}"`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error(`Admin failed to refresh cache entry ${key}`, { error: message });
        req.flash("error", `Failed to refresh cache entry "${key}"`);
      }

      return res.redirect("/admin/cache");
    },
  );

  router.post(
    "/admin/cache/refresh-all",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      void context.cron.tasks.refreshCache().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error("Admin-triggered refresh-all failed", { error: message });
      });

      req.flash("success", "Cache refresh started — entries will update in the background");
      return res.redirect("/admin/cache");
    },
  );

  return router;
}
