import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { createAdminService } from "./admin.service";
import {
  userIdParamValidation,
  updateApiLimitValidation,
  usersQueryValidation,
  cacheKeyValidation,
  cacheQueryValidation,
  userHistoryQueryValidation,
} from "./admin.validation";

export function createAdminRouter(context: AppContext) {
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

  const adminService = createAdminService(
    context.userRepository,
    context.cache,
    context.authService,
    context.logger,
    context.apiCallLogRepository,
  );

  const router = express.Router();

  router.get(
    "/",
    middleware.sessionAdminAuthenticationMiddleware,
    (req: Request, res: Response) => {
      return res.redirect("/dashboard");
    },
  );

  router.get(
    "/users",
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
    "/users/:id/api-limit",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({
      params: userIdParamValidation,
      body: updateApiLimitValidation,
    }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;
      const apiCallLimit = req.body.api_call_limit as number;

      const user = await adminService.updateUserApiCallLimit(id, apiCallLimit);

      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/admin/users");
      }

      context.logger.info(`Admin updated user ${id} api_call_limit to ${apiCallLimit}`);

      req.flash("success", `API call limit updated to ${apiCallLimit}`);
      return res.redirect("/admin/users");
    },
  );

  router.get(
    "/users/:id",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.validationMiddleware({
      params: userIdParamValidation,
      query: userHistoryQueryValidation,
    }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;
      const page = req.query.page as number | undefined;
      const search = req.query.search as string | undefined;

      const user = await adminService.getUserById(id);
      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/admin/users");
      }

      const { calls, pagination } = await adminService.getUserApiCallHistory(id, { page, search });

      return res.render("admin/user-details.html", {
        title: `User: ${user.name}`,
        path: "/admin/users",
        viewedUser: user,
        calls,
        pagination,
        search: search || "",
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.get(
    "/cache",
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
    "/cache/clear",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      await adminService.clearAllCache();

      req.flash("success", "All cache entries cleared");
      return res.redirect("/admin/cache");
    },
  );

  router.post(
    "/cache/delete",
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

  return router;
}
