import type { FC } from "hono/jsx";

import { EndpointCard } from "../_components/EndpointCard";
import { StatCounter } from "../_components/StatCounter";
import { MainLayout, type AppState } from "../_layouts/main";

interface HomeRanking {
  rank: number;
  name: string;
  username: string;
  dots: number;
  total: number;
  equipment: string;
}

interface HomePageProps {
  state: AppState;
  rankings: HomeRanking[] | null;
}

const COUNTER_SCRIPT = `(function(){var counters=document.querySelectorAll('.counter');var animated=false;function animateCounter(c){var target=parseFloat(c.dataset.target);var start=parseFloat(c.dataset.start)||0;var decimals=parseInt(c.dataset.decimals)||0;var suffix=c.dataset.suffix||'';var duration=2000;var steps=60;var stepDuration=duration/steps;var current=start;var increment=(target-start)/steps;function update(){current+=increment;if(current>=target){c.textContent=(decimals>0?target.toFixed(decimals):target)+suffix}else{var d=decimals>0?current.toFixed(decimals):Math.floor(current);c.textContent=d+suffix;requestAnimationFrame(function(){setTimeout(update,stepDuration)})}}update()}function handle(entries){entries.forEach(function(e){if(e.isIntersecting&&!animated){animated=true;counters.forEach(function(c,i){setTimeout(function(){animateCounter(c)},i*150)})}})}var obs=new IntersectionObserver(handle,{threshold:0.5});var g=document.getElementById('stats-grid');if(g){obs.observe(g)}})();`;

export const HomePage: FC<HomePageProps> = ({ state, rankings }) => (
  <MainLayout state={state} path="/">
    <section class="relative">
      <div class="mx-auto max-w-5xl px-4 text-center">
        <div class="max-w-8xl pointer-events-none absolute -top-40 left-1/2 -z-10 h-[900px] w-full -translate-x-1/2 opacity-10">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
          <img
            src="/img/sumo-deadlift.webp"
            alt=""
            class="h-full w-full object-cover object-top [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_80%)]"
          />
        </div>
        <p class="fade-in-heading mb-4 text-sm font-medium uppercase tracking-wider text-power">
          Powerlifting Data API
        </p>
        <h1 class="fade-in-heading animation-delay-1 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Build powerlifting apps
          <br class="hidden sm:inline" />
          <span class="text-neutral-400"> in minutes, not months</span>
        </h1>
        <p class="fade-in-heading animation-delay-2 mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
          Query 3 million competition results with a single API call. No scraping. No parsing. Just
          clean, structured data.
        </p>
        <div class="fade-in-heading animation-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            class="rounded-md bg-power px-4 py-2 font-medium text-white shadow-lg shadow-power-glow transition-all hover:bg-power-dark hover:shadow-xl hover:shadow-power-glow"
            href="/docs/api"
          >
            Read the docs
          </a>
          <a
            class="rounded-md border border-neutral-700 px-4 py-2 text-neutral-300 transition-all hover:border-power hover:text-white"
            href="/api/rankings?limit=10"
            target="_blank"
          >
            Try /api/rankings
          </a>
        </div>
        <p class="fade-in-heading animation-delay-3 mt-4 text-sm text-neutral-500">
          Public API. No keys, no signup, no rate-limit hassle.
        </p>
      </div>
    </section>

    <section class="mt-24">
      <div class="fade-in animation-delay-4 mx-auto max-w-5xl px-4">
        <h2 class="mb-3 text-center text-2xl font-bold text-white">
          Tired of scraping OpenPowerlifting?
        </h2>
        <p class="mb-8 text-center text-neutral-500">We did the hard work so you don't have to.</p>
        <div class="grid gap-4 text-center sm:grid-cols-3" id="stats-grid">
          <StatCounter
            target="3.3"
            start="1.0"
            decimals="1"
            suffix="M+"
            label="Competition results"
            description="Every squat, bench, deadlift recorded"
          />
          <StatCounter
            target="500"
            suffix="K+"
            label="Unique athletes"
            description="From local meets to world championships"
          />
          <StatCounter
            target="100"
            suffix="+"
            label="Countries represented"
            description="USAPL, USPA, IPF, WRPF, and more"
          />
        </div>
      </div>
    </section>

    <section class="mt-24">
      <div class="fade-in animation-delay-5 mx-auto max-w-5xl px-4">
        <h2 class="mb-3 text-center text-2xl font-bold text-white">
          Six endpoints. Unlimited possibilities.
        </h2>
        <p class="mb-10 text-center text-neutral-500">
          Simple, RESTful API designed for developers
        </p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EndpointCard
            name="/rankings"
            tagline="Query the all-time leaderboard"
            description="Filter by federation, weight class, equipment, sex, year. Sort by total, squat, bench, or deadlift."
            icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
          <EndpointCard
            name="/records"
            tagline="Get world and federation records"
            description="Raw, wraps, single-ply, multi-ply. By weight class and sex. Always up-to-date."
            icon="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"
          />
          <EndpointCard
            name="/meets"
            tagline="Search competitions worldwide"
            description="Find meets by federation, country, or date range. Returns full results for every competitor."
            icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
          />
          <EndpointCard
            name="/users/{name}"
            tagline="Get complete athlete profiles"
            description="Full competition history, personal records, progression over time. Everything about any lifter."
            icon="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
          />
          <EndpointCard
            name="/federations"
            tagline="Browse all federations"
            description="List meets by federation. USAPL, USPA, IPF, WRPF, and 100+ more organizations worldwide."
            icon="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z"
          />
          <EndpointCard
            name="/status"
            tagline="Check data source status"
            description="Server version, total meets tracked, and federation import status. Monitor data freshness."
            icon="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
          />
        </div>
      </div>
    </section>

    <section class="mt-24">
      <div class="fade-in animation-delay-6 mx-auto max-w-5xl px-4">
        <h2 class="mb-2 text-center text-2xl font-bold text-white">See it in action</h2>
        <p class="mb-6 text-center text-neutral-500">Live data from /api/rankings</p>
        {rankings == null || rankings.length === 0 ? (
          <div class="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-400">
            Data is loading. Refresh in a moment.
          </div>
        ) : (
          <div class="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
            <table class="w-full text-left">
              <thead class="border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th class="whitespace-nowrap p-4">Rank</th>
                  <th class="whitespace-nowrap p-4">Name</th>
                  <th class="whitespace-nowrap p-4">Dots</th>
                  <th class="whitespace-nowrap p-4">Total (kg)</th>
                  <th class="whitespace-nowrap p-4">Equipment</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-800">
                {rankings.map((row) => (
                  <tr class="hover:bg-neutral-800/50">
                    <td class="whitespace-nowrap p-4">
                      <span class="font-bold text-power">{row.rank}</span>
                    </td>
                    <td class="whitespace-nowrap p-4">
                      <a
                        class="font-medium text-neutral-300 hover:text-power"
                        href={`/api/users/${row.username}`}
                      >
                        {row.name}
                      </a>
                    </td>
                    <td class="whitespace-nowrap p-4 text-neutral-400">{row.dots}</td>
                    <td class="whitespace-nowrap p-4 text-neutral-400">{row.total}</td>
                    <td class="whitespace-nowrap p-4 text-neutral-400">{row.equipment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>

    <section class="mt-24">
      <div class="fade-in animation-delay-7 mx-auto max-w-5xl px-4">
        <div class="overflow-hidden rounded-2xl border border-neutral-800 bg-black px-4 py-16 text-center transition-all hover:border-power/50">
          <h2 class="mb-4 text-2xl font-bold text-white">Open data. Open API. No friction.</h2>
          <p class="mb-8 text-neutral-400">
            Hit any endpoint right now. No registration, no API key.
          </p>
          <a
            class="inline-block rounded-md bg-power px-4 py-2 font-medium text-white shadow-lg shadow-power-glow transition-all hover:bg-power-dark hover:shadow-xl hover:shadow-power-glow"
            href="/docs/api"
          >
            Browse the docs
          </a>
          <p class="mt-6 text-sm text-neutral-500">
            Data sourced from{" "}
            <a
              class="text-power/80 hover:text-power"
              href="https://openpowerlifting.org"
              target="_blank"
            >
              OpenPowerlifting.org
            </a>
          </p>
        </div>
      </div>
    </section>

    <script>{COUNTER_SCRIPT}</script>
  </MainLayout>
);
