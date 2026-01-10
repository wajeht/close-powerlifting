import express, { Request, Response } from "express";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { createHealthCheckService } from "../api/health-check/health-check.service";
import { createRankingService } from "../api/rankings/rankings.service";
import { createMiddleware } from "../middleware";

const RANKINGS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const ONE_DAY_SECONDS = 86400;
const ONE_HOUR_SECONDS = 3600;
let rankingsCache: { data: unknown; timestamp: number } | null = null;

export function createGeneralRouter(context: AppContext) {
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

  const healthCheckService = createHealthCheckService(
    context.cache,
    context.scraper,
    context.logger,
  );
  const rankingService = createRankingService(context.scraper);

  const router = express.Router();

  router.get(
    "/",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    async (req: Request, res: Response) => {
      const now = Date.now();

      if (!rankingsCache || now - rankingsCache.timestamp > RANKINGS_CACHE_TTL) {
        const rankings = await rankingService.getRankings({
          current_page: 1,
          per_page: 9,
        });
        rankingsCache = { data: rankings, timestamp: now };
      }

      return res.status(200).render("general/home.html", {
        path: "/",
        rankings: rankingsCache.data,
      });
    },
  );

  router.get(
    "/about",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (req: Request, res: Response) => {
      return res.status(200).render("general/about.html", {
        path: "/about",
        title: "About",
      });
    },
  );

  router.get("/contact", (_req: Request, res: Response) => {
    return res.redirect(301, "https://github.com/wajeht/close-powerlifting/issues/new/choose");
  });

  router.get(
    "/terms",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (req: Request, res: Response) => {
      return res.status(200).render("general/terms.html", {
        path: "/terms",
        title: "Terms of Service",
      });
    },
  );

  router.get(
    "/privacy",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (req: Request, res: Response) => {
      return res.status(200).render("general/privacy.html", {
        path: "/privacy",
        title: "Privacy Policy",
      });
    },
  );

  router.get(
    "/status",
    middleware.cacheControlMiddleware(ONE_HOUR_SECONDS),
    async (req: Request, res: Response) => {
      const hostname = context.helpers.getHostName(req);
      const adminUser = await context.userRepository.findByEmail(configuration.app.adminEmail);
      const routeGroups = await healthCheckService.getAPIStatus({
        apiKey: adminUser?.api_key || "",
        url: hostname,
      });

      const allGood = routeGroups.every((group: { routes: { status: boolean }[] }) =>
        group.routes.every((route) => route.status),
      );

      return res.status(200).render("general/status.html", {
        path: "/status",
        title: "Status",
        routeGroups,
        allGood,
      });
    },
  );

  router.get("/health-check", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      cache: context.cache.isReady() ? "connected" : "disconnected",
      crons: context.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  router.get("/healthz", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      cache: context.cache.isReady() ? "connected" : "disconnected",
      crons: context.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  return router;
}
