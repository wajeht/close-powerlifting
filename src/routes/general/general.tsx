import { OpenAPIHono } from "@hono/zod-openapi";

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

type StoreState = NonNullable<ReturnType<AppContext["store"]["tryGet"]>>;
type HomeRankings = Awaited<ReturnType<typeof buildHomeRankings>>;

export function createGeneralRouter(context: AppContext) {
  const middleware = createMiddleware(context.helpers, context.logger);
  const app = new OpenAPIHono();
  const homeRankingsCache = createMemoryCache<HomeRankings>({
    ttlMs: Number.POSITIVE_INFINITY,
  });

  async function getHomeRankings(state: StoreState): Promise<HomeRankings> {
    const cached = homeRankingsCache.get(HOME_RANKINGS_CACHE_KEY);
    if (cached !== undefined) return cached;
    return homeRankingsCache.set(HOME_RANKINGS_CACHE_KEY, await buildHomeRankings(state));
  }

  app.get("/", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), async (c) => {
    const state = context.store.tryGet();
    const rankings = state == null ? null : await getHomeRankings(state);
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
    const state = context.store.tryGet();
    const routeGroups =
      state == null ? [] : await getRouteStatuses(`http://127.0.0.1:${configuration.app.port}`);
    const allGood =
      routeGroups.length > 0 ? routeGroups.every((g) => g.routes.every((r) => r.status)) : null;
    return c.render(
      <StatusPage
        ready={state != null}
        rowCount={state?.metadata.entries ?? 0}
        sourceLastModified={state?.metadata.sourceLastModified ?? null}
        ingestedAt={state?.metadata.builtAt ?? null}
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

async function buildHomeRankings(state: StoreState) {
  const rows = await state
    .db("lifter_bests as lb")
    .join("entries as e", "e.id", "lb.entry_id")
    .join("lifters as l", "l.id", "lb.lifter_id")
    .where("lb.metric", "dots")
    .orderBy("lb.rank", "asc")
    .limit(9)
    .select<
      {
        rank: number;
        name: string;
        username: string;
        dots: number | null;
        total_kg: number | null;
        equipment: string;
      }[]
    >({
      rank: "lb.rank",
      name: "l.name",
      username: "l.username",
      dots: "e.dots",
      total_kg: "e.total_kg",
      equipment: "e.equipment",
    });

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
