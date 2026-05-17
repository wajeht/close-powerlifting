import type { FC, PropsWithChildren } from "hono/jsx";
import { OpenAPIHono } from "@hono/zod-openapi";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { getRouteStatuses, type RouteGroup } from "../api/health-check/health-check.service";
import { createMiddleware } from "../middleware";

const ONE_DAY_SECONDS = 86400;
const ONE_HOUR_SECONDS = 3600;

export function createGeneralRouter(context: AppContext) {
  const middleware = createMiddleware(context.helpers, context.logger);
  const app = new OpenAPIHono();

  app.get("/", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) => {
    const data = context.store.tryGet();
    const rankings = data == null ? null : buildHomeRankings(data);
    return c.html(<HomePage rankings={rankings} state={c.get("state")} />);
  });

  app.get("/about", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) => {
    return c.html(<AboutPage state={c.get("state")} />);
  });

  app.get("/contact", (c) =>
    c.redirect("https://github.com/wajeht/close-powerlifting/issues/new/choose", 301),
  );

  app.get("/terms", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) => {
    return c.html(<TermsPage state={c.get("state")} />);
  });

  app.get("/privacy", middleware.cacheControlMiddleware(ONE_DAY_SECONDS), (c) => {
    return c.html(<PrivacyPage state={c.get("state")} />);
  });

  app.get("/status", middleware.cacheControlMiddleware(ONE_HOUR_SECONDS), async (c) => {
    const data = context.store.tryGet();
    const routeGroups =
      data == null ? [] : await getRouteStatuses(`http://127.0.0.1:${configuration.app.port}`);
    const allGood =
      routeGroups.length > 0 && routeGroups.every((g) => g.routes.every((r) => r.status));
    return c.html(
      <StatusPage
        state={c.get("state")}
        ready={data != null}
        rowCount={data?.rowCount ?? 0}
        sourceLastModified={data?.sourceLastModified ?? null}
        ingestedAt={data?.ingestedAt ?? null}
        routeGroups={routeGroups}
        allGood={allGood}
      />,
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

// ---------- JSX layout + pages ----------

interface AppState {
  domain: string;
  currentYear: number;
  env: string;
  routeHealth: boolean | null;
}

interface LayoutProps {
  title: string;
  state: AppState | undefined;
}

const Layout: FC<PropsWithChildren<LayoutProps>> = ({ title, state, children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/css/style.css" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body class="flex min-h-screen flex-col bg-black text-neutral-500">
        <header class="border-b border-neutral-800 px-5 py-3">
          <nav class="mx-auto flex max-w-7xl items-center gap-4 text-sm">
            <a href="/" class="font-bold text-white">
              close-powerlifting
            </a>
            <a href="/about" class="hover:text-white">
              About
            </a>
            <a href="/status" class="hover:text-white">
              Status
              {state?.routeHealth === true && (
                <span class="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" />
              )}
              {state?.routeHealth === false && (
                <span class="ml-1 inline-block h-2 w-2 rounded-full bg-red-500" />
              )}
            </a>
            <a href="/docs/api" class="hover:text-white">
              Docs
            </a>
            <a
              href="https://github.com/wajeht/close-powerlifting"
              class="ml-auto rounded border border-neutral-800 px-2 py-1 hover:bg-neutral-900 hover:text-white"
            >
              GitHub
            </a>
          </nav>
        </header>
        <main id="main" class="flex-1 px-5 py-16">
          <div class="mx-auto max-w-7xl">{children}</div>
        </main>
        <footer class="border-t border-neutral-800 px-5 py-6 text-xs">
          <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <span>© {state?.currentYear ?? new Date().getFullYear()} close-powerlifting</span>
            <span class="space-x-4">
              <a href="/terms" class="hover:text-white">
                Terms
              </a>
              <a href="/privacy" class="hover:text-white">
                Privacy
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
};

interface HomePageProps {
  rankings: ReturnType<typeof buildHomeRankings>;
  state: AppState | undefined;
}

const HomePage: FC<HomePageProps> = ({ rankings, state }) => (
  <Layout title="close-powerlifting — top lifters" state={state}>
    <h1 class="mb-8 text-3xl font-bold text-white">Top lifters by DOTS</h1>
    {rankings == null ? (
      <p>Warming up — snapshot still loading.</p>
    ) : (
      <ol class="space-y-2">
        {rankings.map((r) => (
          <li class="flex items-center gap-4">
            <span class="w-8 text-right text-neutral-600">#{r.rank}</span>
            <a href={`/api/users/${r.username}`} class="font-medium text-white">
              {r.name}
            </a>
            <span class="ml-auto tabular-nums">{r.dots.toFixed(2)} DOTS</span>
            <span class="text-neutral-600">{r.equipment}</span>
          </li>
        ))}
      </ol>
    )}
  </Layout>
);

const AboutPage: FC<{ state: AppState | undefined }> = ({ state }) => (
  <Layout title="About — close-powerlifting" state={state}>
    <h1 class="mb-4 text-3xl font-bold text-white">About</h1>
    <p>
      A read-only REST API mirroring the{" "}
      <a href="https://openpowerlifting.org" class="underline">
        OpenPowerlifting
      </a>{" "}
      dataset. Built in-memory from a weekly-rebuilt snapshot. See{" "}
      <a href="/docs/api" class="underline">
        the API docs
      </a>{" "}
      for endpoints.
    </p>
  </Layout>
);

const TermsPage: FC<{ state: AppState | undefined }> = ({ state }) => (
  <Layout title="Terms of Service — close-powerlifting" state={state}>
    <h1 class="mb-4 text-3xl font-bold text-white">Terms of Service</h1>
    <p>The data is provided as-is, with no guarantees of accuracy or uptime. Use responsibly.</p>
  </Layout>
);

const PrivacyPage: FC<{ state: AppState | undefined }> = ({ state }) => (
  <Layout title="Privacy Policy — close-powerlifting" state={state}>
    <h1 class="mb-4 text-3xl font-bold text-white">Privacy Policy</h1>
    <p>
      This site collects no personal data. Logs include request paths and IP addresses for rate
      limiting only.
    </p>
  </Layout>
);

interface StatusPageProps {
  state: AppState | undefined;
  ready: boolean;
  rowCount: number;
  sourceLastModified: string | null;
  ingestedAt: string | null;
  routeGroups: RouteGroup[];
  allGood: boolean;
}

const StatusPage: FC<StatusPageProps> = ({
  state,
  ready,
  rowCount,
  sourceLastModified,
  ingestedAt,
  routeGroups,
  allGood,
}) => (
  <Layout title="Status — close-powerlifting" state={state}>
    <h1 class="mb-8 text-3xl font-bold text-white">Status</h1>
    {!ready ? (
      <p class="rounded border border-yellow-700 bg-yellow-950 px-4 py-3 text-yellow-300">
        Warming up — snapshot still loading.
      </p>
    ) : (
      <div
        class={`rounded border px-4 py-3 ${
          allGood
            ? "border-green-700 bg-green-950 text-green-300"
            : "border-red-700 bg-red-950 text-red-300"
        }`}
      >
        {allGood ? "All systems operational" : "Some routes are unhealthy"}
      </div>
    )}
    <div class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Entries" value={rowCount.toLocaleString()} />
      <StatCard label="Snapshot built" value={ingestedAt ?? "—"} />
      <StatCard label="Upstream last-modified" value={sourceLastModified ?? "—"} />
      <StatCard
        label="Source"
        value={
          <a href="https://openpowerlifting.org" class="underline">
            OpenPowerlifting
          </a>
        }
      />
    </div>
    <div class="mt-12 space-y-8">
      {routeGroups.map((group) => (
        <div>
          <h2 class="mb-3 text-xl font-bold text-white">{group.name}</h2>
          <ul class="space-y-1">
            {group.routes.map((r) => (
              <li class="flex items-center gap-3">
                <span
                  class={`inline-block h-2 w-2 rounded-full ${r.status ? "bg-green-500" : "bg-red-500"}`}
                />
                <code class="text-xs">{r.url}</code>
                <span class="ml-auto text-xs text-neutral-600">{r.date}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </Layout>
);

const StatCard: FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div class="rounded border border-neutral-800 p-4">
    <div class="text-xs uppercase tracking-wider text-neutral-600">{label}</div>
    <div class="mt-1 text-sm text-white">{value}</div>
  </div>
);
