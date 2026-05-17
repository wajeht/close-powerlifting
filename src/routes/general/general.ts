import express, { Request, Response } from "express";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { getRouteStatuses } from "../api/health-check/health-check.service";
import { createMiddleware } from "../middleware";

const ONE_DAY_SECONDS = 86400;
const ONE_HOUR_SECONDS = 3600;

export function createGeneralRouter(context: AppContext) {
  const middleware = createMiddleware(context.helpers, context.logger);
  const router = express.Router();

  router.get(
    "/",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (_req: Request, res: Response) => {
      const data = context.store.tryGet();
      const rankings = data == null ? null : buildHomeRankings(data);
      res.status(200).render("general/home.html", { path: "/", rankings });
    },
  );

  router.get(
    "/about",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (_req: Request, res: Response) => {
      res.status(200).render("general/about.html", { path: "/about", title: "About" });
    },
  );

  router.get("/contact", (_req: Request, res: Response) => {
    res.redirect(301, "https://github.com/wajeht/close-powerlifting/issues/new/choose");
  });

  router.get(
    "/terms",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (_req: Request, res: Response) => {
      res.status(200).render("general/terms.html", { path: "/terms", title: "Terms of Service" });
    },
  );

  router.get(
    "/privacy",
    middleware.cacheControlMiddleware(ONE_DAY_SECONDS),
    (_req: Request, res: Response) => {
      res.status(200).render("general/privacy.html", {
        path: "/privacy",
        title: "Privacy Policy",
      });
    },
  );

  router.get(
    "/status",
    middleware.cacheControlMiddleware(ONE_HOUR_SECONDS),
    async (_req: Request, res: Response) => {
      const data = context.store.tryGet();
      const routeGroups =
        data == null ? [] : await getRouteStatuses(`http://127.0.0.1:${configuration.app.port}`);
      const allGood =
        routeGroups.length > 0 && routeGroups.every((g) => g.routes.every((r) => r.status));
      res.status(200).render("general/status.html", {
        path: "/status",
        title: "Status",
        ready: data != null,
        rowCount: data?.rowCount ?? 0,
        sourceLastModified: data?.sourceLastModified ?? null,
        ingestedAt: data?.ingestedAt ?? null,
        routeGroups,
        allGood,
      });
    },
  );

  router.get("/health-check", handleHealthCheck);
  router.get("/healthz", handleHealthCheck);
  function handleHealthCheck(_req: Request, res: Response): void {
    const ready = context.store.tryGet() != null;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "warming up",
      uptime: process.uptime(),
      timestamp: Date.now(),
      data: ready ? "ready" : "loading",
    });
  }

  return router;
}

function buildHomeRankings(data: ReturnType<AppContext["store"]["tryGet"]>) {
  if (data == null) return null;
  const top = data.rankByMetric.dots.subarray(0, 9);
  return Array.from(top, (lifterId, idx) => {
    const entryId = data.bestEntryByLifter.dots[lifterId];
    if (entryId == null || entryId < 0) return null;
    const lifter = data.lifters[lifterId];
    const entry = data.entries[entryId];
    if (lifter == null || entry == null) return null;
    return {
      rank: idx + 1,
      name: lifter.name,
      username: lifter.username,
      dots: entry.dots ?? 0,
      total: entry.totalKg ?? 0,
      equipment: entry.equipment,
    };
  }).filter((x) => x != null);
}
