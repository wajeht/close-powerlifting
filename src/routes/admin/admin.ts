import express, { Request, Response } from "express";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { createAdminService } from "./admin.service";
import {
  userIdParamValidation,
  usersQueryValidation,
  cacheKeyValidation,
  cacheQueryValidation,
  ingestRunsQueryValidation,
  userHistoryQueryValidation,
} from "./admin.validation";

export function createAdminRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.apiCallLogRepository,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
  );

  const adminService = createAdminService(
    context.knex,
    context.userRepository,
    context.apiCallLogRepository,
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

  router.get(
    "/admin/ingest-runs",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.validationMiddleware({ query: ingestRunsQueryValidation }),
    async (req: Request, res: Response) => {
      const page = req.query.page as number | undefined;

      const { runs, pagination } = await adminService.getIngestRuns({ page });

      return res.render("admin/ingest-runs.html", {
        title: "Ingest Runs",
        path: "/admin/ingest-runs",
        runs,
        pagination,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/admin/ingest-runs/run",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      // Fire-and-forget — the ingest takes ~2 min, can't block the request.
      // If the source CSV hasn't changed since the last successful run the
      // ingest service will record a "skipped" row and exit fast.
      void context.ingest.runNightly().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error("Admin-triggered ingest failed", { error: message });
      });

      req.flash("success", "Ingest started — refresh in a couple minutes to see the result");
      return res.redirect("/admin/ingest-runs");
    },
  );

  router.post(
    "/admin/ingest-runs/run-force",
    middleware.sessionAdminAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      // Force=true bypasses the Last-Modified dedup so the ingest runs even
      // if the upstream CSV hasn't changed. Useful for recovery after a
      // failed run or to validate the pipeline after code changes.
      void context.ingest.runNightly({ force: true }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error("Admin-triggered forced ingest failed", { error: message });
      });

      req.flash("success", "Forced ingest started — refresh in a couple minutes to see the result");
      return res.redirect("/admin/ingest-runs");
    },
  );

  return router;
}
