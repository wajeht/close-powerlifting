import { OpenAPIHono } from "@hono/zod-openapi";
import type { DatabaseSync } from "node:sqlite";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { createMemoryCache } from "../../utils/cache";
import { getRouteStatuses } from "../api/health-check/route-status.service";
import { createMiddleware } from "../middleware";
import { AboutPage } from "./AboutPage";
import { HomePage } from "./HomePage";
import { PrivacyPage } from "./PrivacyPage";
import { StatusPage } from "./StatusPage";
import { TermsPage } from "./TermsPage";

const ONE_DAY_SECONDS = 86400;
const HOME_RANKINGS_CACHE_KEY = "home-rankings";

type HomeRankings = ReturnType<typeof buildHomeRankings>;

export function createGeneralRouter(context: AppContext) {
  const middleware = createMiddleware(context.helpers, context.logger);
  const app = new OpenAPIHono();
  const homeRankingsCache = createMemoryCache<HomeRankings>({
    ttlMs: Number.POSITIVE_INFINITY,
  });

  function getHomeRankings(db: DatabaseSync): HomeRankings {
    const cached = homeRankingsCache.get(HOME_RANKINGS_CACHE_KEY);
    if (cached !== undefined) return cached;
    return homeRankingsCache.set(HOME_RANKINGS_CACHE_KEY, buildHomeRankings(db));
  }

  app.get("/", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) => {
    const ready = context.store.tryGet() != null;
    const rankings = ready ? getHomeRankings(context.store.get()) : null;
    return c.render(<HomePage rankings={rankings} />);
  });

  app.get("/about", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) =>
    c.render(<AboutPage />, { title: "About" }),
  );

  app.get("/contact", (c) =>
    c.redirect("https://github.com/wajeht/close-powerlifting/issues/new/choose", 301),
  );

  app.get("/terms", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) =>
    c.render(<TermsPage />, { title: "Terms of Service" }),
  );

  app.get("/privacy", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) =>
    c.render(<PrivacyPage />, { title: "Privacy Policy" }),
  );

  app.get("/status", middleware.noCacheMiddleware, async (c) => {
    const metadata = context.store.tryGet();
    const routeGroups =
      metadata == null ? [] : await getRouteStatuses(`http://127.0.0.1:${configuration.app.port}`);
    const allGood =
      routeGroups.length > 0 ? routeGroups.every((g) => g.routes.every((r) => r.status)) : null;
    return c.render(
      <StatusPage
        ready={metadata != null}
        rowCount={metadata?.rowCount ?? 0}
        sourceLastModified={metadata?.sourceLastModified ?? null}
        ingestedAt={metadata?.ingestedAt ?? null}
        routeGroups={routeGroups}
        allGood={allGood}
      />,
      { title: "Status" },
    );
  });

  function handleHealthCheck(c: import("hono").Context) {
    const ready = context.store.tryGet() != null;
    return c.json(
      {
        status: ready ? "ok" : "warming up",
        uptime: process.uptime(),
        timestamp: Date.now(),
        data: ready ? "ready" : "loading",
      },
      ready ? 200 : 503,
    );
  }

  app.get("/health-check", handleHealthCheck);
  app.get("/healthz", handleHealthCheck);

  return app;
}

function buildHomeRankings(db: DatabaseSync) {
  const rows = db
    .prepare(
      `
      SELECT
        r.rank,
        l.name,
        l.username,
        e.dots,
        e.total_kg,
        e.equipment
      FROM rankings r
      JOIN entries e ON e.id = r.entry_id
      JOIN lifters l ON l.id = r.lifter_id
      WHERE r.metric = 'dots'
      ORDER BY r.rank
      LIMIT 9
    `,
    )
    .all() as Array<{
    rank: number;
    name: string;
    username: string;
    dots: number | null;
    total_kg: number | null;
    equipment: string;
  }>;

  return rows.map((row) => {
    return {
      rank: row.rank,
      name: row.name,
      username: row.username,
      dots: row.dots ?? 0,
      total: row.total_kg ?? 0,
      equipment: row.equipment,
    };
  });
}
