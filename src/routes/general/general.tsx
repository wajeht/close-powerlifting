import { OpenAPIHono } from "@hono/zod-openapi";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { getRouteStatuses } from "../api/health-check/health-check.service";
import { createMiddleware } from "../middleware";
import { AboutPage } from "./AboutPage";
import { HomePage } from "./HomePage";
import { PrivacyPage } from "./PrivacyPage";
import { StatusPage } from "./StatusPage";
import { TermsPage } from "./TermsPage";

const ONE_DAY_SECONDS = 86400;
const ONE_HOUR_SECONDS = 3600;

export function createGeneralRouter(context: AppContext) {
  const middleware = createMiddleware(context.helpers, context.logger);
  const app = new OpenAPIHono();

  app.get("/", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) => {
    const data = context.store.tryGet();
    const rankings = data == null ? null : buildHomeRankings(data);
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

  app.get("/status", middleware.cacheControlMiddleware(ONE_HOUR_SECONDS), async (c) => {
    const data = context.store.tryGet();
    const routeGroups =
      data == null ? [] : await getRouteStatuses(`http://127.0.0.1:${configuration.app.port}`);
    const allGood =
      routeGroups.length > 0 && routeGroups.every((g) => g.routes.every((r) => r.status));
    return c.render(
      <StatusPage
        ready={data != null}
        rowCount={data?.rowCount ?? 0}
        sourceLastModified={data?.sourceLastModified ?? null}
        ingestedAt={data?.ingestedAt ?? null}
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
