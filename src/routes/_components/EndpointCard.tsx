import type { FC } from "hono/jsx";

interface EndpointCardProps {
  name: string;
  tagline: string;
  description: string;
  icon: string;
}

export const EndpointCard: FC<EndpointCardProps> = ({ name, tagline, description, icon }) => (
  <div class="group relative overflow-hidden rounded-lg border border-neutral-800 bg-black p-6 transition-all hover:border-power/50">
    <svg
      class="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 text-neutral-800/40"
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
      <p class="mb-3 text-neutral-300">{tagline}</p>
      <p class="text-neutral-500">{description}</p>
    </div>
  </div>
);
