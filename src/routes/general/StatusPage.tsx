import type { FC } from "hono/jsx";

import { InfoCard } from "../_components/InfoCard";
import { PageHero } from "../_components/PageHero";
import { StatusBanner } from "../_components/StatusBanner";
import type { RouteGroup } from "../api/health-check/health-check.service";

interface StatusPageProps {
  ready: boolean;
  rowCount: number;
  sourceLastModified: string | null;
  ingestedAt: string | null;
  routeGroups: RouteGroup[];
  allGood: boolean;
}

const STATUS_TOGGLE_SCRIPT = `(function(){document.querySelectorAll('.status-route').forEach(function(a){var t=a.querySelector('.status-route-toggle');var p=a.querySelector('.status-route-pre');var c=a.querySelector('.status-route-chevron');if(!p)return;if(p.textContent){try{p.textContent=JSON.stringify(JSON.parse(p.textContent),null,2)}catch(e){}}t.addEventListener('click',function(){var x=p.classList.toggle('hidden')===false;t.setAttribute('aria-expanded',String(x));if(c){c.classList.toggle('rotate-180',x)}})})})();`;

export const StatusPage: FC<StatusPageProps> = ({
  ready,
  rowCount,
  sourceLastModified,
  ingestedAt,
  routeGroups,
  allGood,
}) => (
  <>
    <PageHero
      title="API Status"
      subtitle="Snapshot freshness, dataset counts, and per-endpoint health probes."
    />
    <div class="mx-auto max-w-5xl px-4">
      <section class="flex flex-col gap-6">
        <StatusBanner ready={ready} allGood={allGood} rowCount={rowCount} />
        <div class="fade-in animation-delay-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard label="Total entries" value={rowCount.toLocaleString()} />
          <InfoCard label="Snapshot built" value={ingestedAt ?? "—"} />
          <InfoCard label="Upstream Last-Modified" value={sourceLastModified ?? "—"} />
          <article class="card-lift rounded-lg border border-neutral-200/70 bg-white p-4 transition-all hover:border-power/50 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:shadow-none">
            <div class="text-sm text-neutral-600 dark:text-neutral-400">Data source</div>
            <div class="mt-1 text-xl font-semibold text-neutral-900 dark:text-white">
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
                <h2 class="frosted sticky top-[72px] z-30 py-2 font-display text-xl tracking-tight text-neutral-900 dark:text-white">
                  {group.name}
                </h2>
                <div class="flex flex-col gap-2">
                  {group.routes.map((item) => (
                    <article class="status-route flex flex-col gap-2 card-lift rounded-lg border border-neutral-200/70 bg-white p-4 transition-all hover:border-power/50 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:shadow-none">
                      <button
                        type="button"
                        class="status-route-toggle flex w-full items-start justify-between gap-4 text-left"
                        aria-expanded="false"
                      >
                        <div class="flex min-w-0 flex-col gap-2">
                          <div class="flex gap-4 text-neutral-600 dark:text-neutral-400">
                            <div class="font-bold text-neutral-900 dark:text-white">
                              {item.method}
                            </div>
                            <div class="overflow-x-auto rounded bg-neutral-200 px-2 font-mono dark:bg-neutral-800">
                              {item.url}
                            </div>
                          </div>
                          <div class="flex flex-wrap gap-1 text-sm">
                            {item.status ? (
                              <span class="text-green-600 dark:text-green-400">Healthy</span>
                            ) : (
                              <span class="text-power">Unhealthy</span>
                            )}
                            <div class="text-neutral-500">as of</div>
                            <div class="text-neutral-600 dark:text-neutral-400">{item.date}</div>
                          </div>
                        </div>
                        {item.body && (
                          <svg
                            class="status-route-chevron mt-1 h-5 w-5 flex-shrink-0 text-neutral-600 transition-transform dark:text-neutral-400"
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
                      </button>
                      {item.body && (
                        <pre class="status-route-pre hidden max-h-96 overflow-auto rounded bg-neutral-50 p-3 text-xs text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
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
