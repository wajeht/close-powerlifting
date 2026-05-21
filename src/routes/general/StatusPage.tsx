import type { FC } from "hono/jsx";

import { InfoCard } from "../_components/InfoCard";
import { StatusBanner } from "../_components/StatusBanner";
import type { RouteGroup } from "../api/health-check/route-status.service";

interface StatusPageProps {
  ready: boolean;
  rowCount: number;
  sourceLastModified: string | null;
  ingestedAt: string | null;
  routeGroups: RouteGroup[];
  allGood: boolean | null;
}

const STATUS_TOGGLE_SCRIPT = `(function(){document.querySelectorAll('.status-route').forEach(function(card){var button=card.querySelector('.status-route-toggle');var pre=card.querySelector('.status-route-pre');var chevron=card.querySelector('.status-route-chevron');if(!button||!pre)return;button.addEventListener('click',function(){var isOpen=pre.classList.toggle('hidden')===false;button.setAttribute('aria-expanded',String(isOpen));if(chevron)chevron.classList.toggle('rotate-180',isOpen)})})})();`;

export const StatusPage: FC<StatusPageProps> = ({
  ready,
  rowCount,
  sourceLastModified,
  ingestedAt,
  routeGroups,
  allGood,
}) => (
  <>
    <div class="mx-auto max-w-5xl px-4">
      <header class="fade-in-heading mb-6">
        <h1 class="text-2xl font-bold text-white">API Status</h1>
        <p class="mt-2 text-neutral-400">
          Snapshot freshness, dataset counts, and per-endpoint health probes.
        </p>
      </header>
      <section class="flex flex-col gap-6">
        <StatusBanner ready={ready} allGood={allGood} rowCount={rowCount} />
        <div class="fade-in animation-delay-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard label="Total entries" value={rowCount.toLocaleString()} />
          <InfoCard label="Snapshot built" value={ingestedAt ?? "—"} />
          <InfoCard label="Upstream Last-Modified" value={sourceLastModified ?? "—"} />
          <article class="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-all hover:border-power/50">
            <div class="text-sm text-neutral-400">Data source</div>
            <div class="mt-1 text-xl font-semibold text-white">
              <a
                class="hover:underline"
                href="https://openpowerlifting.org"
                target="_blank"
                rel="noopener"
              >
                OpenPowerlifting
              </a>
            </div>
          </article>
        </div>
        {routeGroups.length > 0
          ? routeGroups.map((group) => (
              <div class="fade-in animation-delay-4 flex flex-col gap-3">
                <h2 class="frosted sticky top-[72px] z-30 py-2 text-lg font-semibold text-white">
                  {group.name}
                </h2>
                <div class="flex flex-col gap-2">
                  {group.routes.map((item) => (
                    <article class="status-route flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-all hover:border-power/50">
                      <button
                        type="button"
                        class="status-route-toggle flex w-full items-start justify-between gap-4 text-left"
                        aria-expanded="false"
                      >
                        <div class="flex min-w-0 flex-col gap-2">
                          <div class="flex gap-4 text-neutral-400">
                            <div class="font-bold text-white">{item.method}</div>
                            <div class="overflow-x-auto rounded bg-neutral-800 px-2 font-mono">
                              {item.url}
                            </div>
                          </div>
                          <div class="flex flex-wrap gap-1 text-sm">
                            {item.status ? (
                              <span class="text-green-400">Healthy</span>
                            ) : (
                              <span class="text-power">Unhealthy</span>
                            )}
                            <div class="text-neutral-500">as of</div>
                            <div class="text-neutral-400">{item.date}</div>
                          </div>
                        </div>
                        <div class="flex shrink-0 items-center gap-3">
                          <span class="text-sm text-neutral-400">{item.durationMs}ms</span>
                          {item.body && (
                            <svg
                              class="status-route-chevron h-5 w-5 text-neutral-400 transition-transform"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                      {item.body && (
                        <pre class="status-route-pre hidden max-h-96 overflow-auto rounded bg-neutral-950 p-3 text-xs text-neutral-300">
                          {item.body}
                        </pre>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))
          : ready && (
              <p class="fade-in animation-delay-4 text-sm text-neutral-500">
                Probing route health — refresh in a moment.
              </p>
            )}
      </section>
    </div>
    <script dangerouslySetInnerHTML={{ __html: STATUS_TOGGLE_SCRIPT }} />
  </>
);
