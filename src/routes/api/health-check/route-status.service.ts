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

interface RouteStatusCacheEntry {
  routeGroups: RouteGroup[];
  expiresAt: number;
}

// Per-route timeout for background probes. Keep this bounded, but /status
// never awaits these probes on the browser request path.
const FETCH_TIMEOUT_MS = 10_000;

// Cache TTL for the route status payload. The /status HTML page only renders
// the last cached snapshot and refreshes it in the background.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_STATUS_BODY_LENGTH = 2_048;

// Ordered list of every API endpoint we surface on /status. Grouped so the
// HTML page can render sticky headers per tag. Variations of the same
// route are included to exercise different query/path branches. Keep probes
// representative and cheap; exhaustive branch coverage belongs in tests, not
// in a page render health sweep.
const ROUTE_DEFINITIONS: RouteDefinition[] = [
  { group: "Rankings", path: "/api/rankings" },
  { group: "Rankings", path: "/api/rankings/1" },
  { group: "Rankings", path: "/api/rankings?current_page=1&per_page=100" },
  { group: "Rankings", path: "/api/rankings?units=kg" },
  { group: "Rankings", path: "/api/rankings/filter/raw?federation=ipf&per_page=10" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men?federation=ipf&per_page=10" },
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
  { group: "Records", path: "/api/records/raw/ipf-classes/men?age_class=40-44" },

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

let routeStatusCache: RouteStatusCacheEntry | null = null;
let routeStatusRefresh: Promise<void> | null = null;

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
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    formatted = body;
  }
  if (formatted.length <= MAX_STATUS_BODY_LENGTH) return formatted;
  return `${formatted.slice(0, MAX_STATUS_BODY_LENGTH)}\n... [truncated]`;
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

function isRouteStatusCacheFresh(): boolean {
  return routeStatusCache != null && routeStatusCache.expiresAt > Date.now();
}

// Returns the last route status payload synchronously. This is intentionally a
// stale-while-refresh read so /status cannot block on slow endpoint probes.
export function getCachedRouteStatuses(): RouteGroup[] {
  return routeStatusCache?.routeGroups ?? [];
}

export function refreshRouteStatusesInBackground(baseUrl: string): void {
  if (isRouteStatusCacheFresh() || routeStatusRefresh != null) return;

  routeStatusRefresh = refreshRouteStatuses(baseUrl)
    .then((routeGroups) => {
      routeStatusCache = {
        routeGroups,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
    })
    .catch(() => {
      // Swallow - the next refresh attempt will retry.
    })
    .finally(() => {
      routeStatusRefresh = null;
    });
}

// Fire-and-forget warm hook invoked from server.ts once the data store is
// ready. Logs failures but never throws; a status page that's missing
// route data is degraded, not broken.
export function warmRouteStatuses(baseUrl: string): void {
  refreshRouteStatusesInBackground(baseUrl);
}

// Sync readout of the cached health summary. Used by the nav dot so that
// every page render can show "all healthy / degraded / unknown" without
// triggering a probe sweep on the request path. Returns null until the
// first probe completes.
export function getCachedRouteHealth(): boolean | null {
  const groups = routeStatusCache?.routeGroups;
  if (groups == null) return null;
  return groups.every((g) => g.routes.every((r) => r.status));
}

export function resetRouteStatusesForTesting(): void {
  routeStatusCache = null;
  routeStatusRefresh = null;
}
