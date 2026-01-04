import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { createAdminService } from "./admin.service";
import {
  userIdParamValidation,
  updateApiCountValidation,
  updateApiLimitValidation,
  usersQueryValidation,
  cacheKeyValidation,
} from "./admin.validation";

export function createAdminRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
  );

  const adminService = createAdminService(
    context.userRepository,
    context.cache,
    context.authService,
    context.logger,
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

  router.get(
    "/users/:id",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.validationMiddleware({ params: userIdParamValidation }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;

      const user = await adminService.getUserById(id);

      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/admin/users");
      }

      return res.render("admin/user-edit.html", {
        title: `Edit User: ${user.name}`,
        path: "/admin/users",
        editUser: user,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/users/:id/api-count",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({
      params: userIdParamValidation,
      body: updateApiCountValidation,
    }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;
      const apiCallCount = req.body.api_call_count as number;

      const user = await adminService.updateUserApiCallCount(id, apiCallCount);

      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/admin/users");
      }

      context.logger.info(`Admin updated user ${id} api_call_count to ${apiCallCount}`);

      req.flash("success", `API call count updated to ${apiCallCount}`);
      return res.redirect(`/admin/users/${id}`);
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
      return res.redirect(`/admin/users/${id}`);
    },
  );

  router.post(
    "/users/:id/resend-verification",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ params: userIdParamValidation }),
    async (req: Request, res: Response) => {
      const id = req.params.id as unknown as number;
      const hostname = context.helpers.getHostName(req);

      const sent = await adminService.resendVerificationEmail(id, hostname);

      if (sent) {
        req.flash("success", "Verification email sent");
      } else {
        req.flash("error", "Could not send verification email (user may already be verified)");
      }

      return res.redirect(`/admin/users/${id}`);
    },
  );

  router.get(
    "/cache",
    middleware.sessionAdminAuthenticationMiddleware,
    async (req: Request, res: Response) => {
      const search = (req.query.search as string) || "";
      const pattern = search ? `%${search}%` : "%";
      const entries = await adminService.getCacheEntries(pattern);

      return res.render("admin/cache-view.html", {
        title: "Cache Management",
        path: "/admin/cache",
        entries,
        search,
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
