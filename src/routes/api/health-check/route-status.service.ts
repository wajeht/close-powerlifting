import { createMemoryCache } from "../../../utils/cache";

export interface RouteStatus {
  status: boolean;
  method: string;
  url: string;
  date: string;
  durationMs: number;
  body: string | null;
}

export interface RouteGroup {
  name: string;
  routes: RouteStatus[];
}

interface RouteDefinition {
  group: string;
  path: string;
}

// Per-route timeout for the probes. 10 s is long enough that a cold V8
// optimisation pass on a complex filter route won't false-positive as
// "Unavailable", short enough that a hung route can't stall the page.
const FETCH_TIMEOUT_MS = 10_000;

// Cache TTL for the route status payload. The /status HTML page renders this
// cached snapshot, including response bodies, instead of probing on every hit.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ROUTE_STATUS_CACHE_KEY = "route-statuses";

// Ordered list of every API endpoint we surface on /status. Grouped so the
// HTML page can render sticky headers per tag. Variations of the same
// route are included to exercise different query/path branches.
const ROUTE_DEFINITIONS: RouteDefinition[] = [
  { group: "Rankings", path: "/api/rankings" },
  { group: "Rankings", path: "/api/rankings/1" },
  { group: "Rankings", path: "/api/rankings?current_page=1&per_page=100" },
  { group: "Rankings", path: "/api/rankings?units=kg" },
  { group: "Rankings", path: "/api/rankings/filter/raw" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-dots" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-wilks" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-total" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men?age_class=40-44" },

  { group: "Federations", path: "/api/federations" },
  { group: "Federations", path: "/api/federations?current_page=1&per_page=100" },
  { group: "Federations", path: "/api/federations/ipf" },
  { group: "Federations", path: "/api/federations/ipf?year=2024" },
  { group: "Federations", path: "/api/federations/ipf/stats" },

  { group: "Meets", path: "/api/meets" },
  { group: "Meets", path: "/api/meets?federation=usapl" },
  { group: "Meets", path: "/api/meets?from=2024-01-01&to=2024-12-31" },
  { group: "Meets", path: "/api/meets?country=USA" },
  { group: "Meets", path: "/api/meets?search=nationals" },
  { group: "Meets", path: "/api/meets?per_page=10&current_page=1" },

  { group: "Records", path: "/api/records" },
  { group: "Records", path: "/api/records/raw" },
  { group: "Records", path: "/api/records/raw/men" },
  { group: "Records", path: "/api/records/raw/100" },
  { group: "Records", path: "/api/records/raw/ipf-classes/men" },
  { group: "Records", path: "/api/records?age_class=40-44" },

  { group: "Users", path: "/api/users" },
  { group: "Users", path: "/api/users?search=haack" },
  { group: "Users", path: "/api/users/johnhaack" },
  { group: "Users", path: "/api/users/johnhaack?include_attempts=true&units=kg" },
  { group: "Users", path: "/api/users/johnhaack/progression" },
  { group: "Users", path: "/api/users/johnhaack/personal-bests" },
  { group: "Users", path: "/api/users/johnhaack/rank" },
  { group: "Users", path: "/api/users/compare?a=johnhaack&b=kristyhawkins" },

  { group: "Public", path: "/api/status" },
  { group: "Public", path: "/api/health-check" },
];

const GROUP_ORDER: ReadonlyArray<string> = [
  "Rankings",
  "Federations",
  "Meets",
  "Records",
  "Users",
  "Public",
];

const routeStatusCache = createMemoryCache<RouteGroup[]>({ ttlMs: CACHE_TTL_MS });

async function probeRoute(baseUrl: string, path: string): Promise<RouteStatus> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await response.text();
    return {
      status: response.ok,
      method: "GET",
      url: path,
      date: response.headers.get("date") ?? new Date().toUTCString(),
      durationMs: Date.now() - startedAt,
      body: formatBody(body),
    };
  } catch {
    return {
      status: false,
      method: "GET",
      url: path,
      date: new Date().toUTCString(),
      durationMs: Date.now() - startedAt,
      body: null,
    };
  }
}

function formatBody(body: string): string | null {
  if (body.length === 0) return null;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

async function refreshRouteStatuses(baseUrl: string): Promise<RouteGroup[]> {
  // Sequential - parallel self-fetches against the single-process Hono
  // server can saturate Node's HTTP agent pool and leave requests hanging.
  // 40-ish probes x ~5 ms each is well below the cache TTL.
  const byGroup = new Map<string, RouteStatus[]>();
  for (const name of GROUP_ORDER) byGroup.set(name, []);

  for (const def of ROUTE_DEFINITIONS) {
    const status = await probeRoute(baseUrl, def.path);
    byGroup.get(def.group)?.push(status);
  }

  const groups: RouteGroup[] = [];
  for (const name of GROUP_ORDER) {
    const routes = byGroup.get(name);
    if (routes != null && routes.length > 0) groups.push({ name, routes });
  }

  return groups;
}

// Returns the cached route status payload, falling back to a fresh probe
// if the cache is missing or stale. Coalesces concurrent callers onto the
// same in-flight refresh so the /status page never kicks off more than one
// probe sweep at a time.
export async function getRouteStatuses(baseUrl: string): Promise<RouteGroup[]> {
  return routeStatusCache.getOrSet(ROUTE_STATUS_CACHE_KEY, () => refreshRouteStatuses(baseUrl));
}

// Fire-and-forget warm hook invoked from server.ts once the data store is
// ready. Logs failures but never throws; a status page that's missing
// route data is degraded, not broken.
export function warmRouteStatuses(baseUrl: string): void {
  getRouteStatuses(baseUrl).catch(() => {
    // Swallow - the next /status hit will retry.
  });
}

// Sync readout of the cached health summary. Used by the nav dot so that
// every page render can show "all healthy / degraded / unknown" without
// triggering a probe sweep on the request path. Returns null until the
// first probe completes.
export function getCachedRouteHealth(): boolean | null {
  const groups = routeStatusCache.peek(ROUTE_STATUS_CACHE_KEY);
  if (groups == null) return null;
  return groups.every((g) => g.routes.every((r) => r.status));
}
