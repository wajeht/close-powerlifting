import type { FC } from "hono/jsx";

interface EndpointCardProps {
  name: string;
  tagline: string;
  description: string;
  icon: string;
}

export const EndpointCard: FC<EndpointCardProps> = ({ name, tagline, description, icon }) => (
  <div class="card-lift group relative overflow-hidden rounded-lg border border-neutral-200/70 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-power/50 hover:shadow-md dark:border-neutral-800 dark:bg-black dark:hover:translate-y-0 dark:hover:shadow-none">
    <svg
      class="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 text-neutral-200/60 dark:text-neutral-800/40"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d={icon} />
    </svg>
    <div class="relative">
      <h3 class="mb-1 font-mono text-lg font-semibold text-power">{name}</h3>
      <p class="mb-3 text-neutral-700 dark:text-neutral-300">{tagline}</p>
      <p class="text-neutral-500">{description}</p>
    </div>
  </div>
);
