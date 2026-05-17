import type { FC } from "hono/jsx";

export const HealthDot: FC<{ health: boolean | null }> = ({ health }) => {
  if (health === true) {
    return (
      <span
        class="pointer-events-none absolute right-[-10px] top-[-1px] inline-flex h-1.5 w-1.5"
        aria-label="All systems operational"
        title="All systems operational"
      >
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
        <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
    );
  }
  if (health === false) {
    return (
      <span
        class="pointer-events-none absolute right-[-10px] top-[-1px] inline-block h-1.5 w-1.5 rounded-full bg-power"
        aria-label="Service degraded"
        title="Service degraded"
      />
    );
  }
  return null;
};
