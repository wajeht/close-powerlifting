import type { FC } from "hono/jsx";

interface StatCounterProps {
  target: string;
  start?: string;
  decimals?: string;
  suffix: string;
  label: string;
  description: string;
}

export const StatCounter: FC<StatCounterProps> = ({
  target,
  start,
  decimals,
  suffix,
  label,
  description,
}) => (
  <div class="card-lift rounded-lg border border-neutral-200/70 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-power/50 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:translate-y-0 dark:hover:shadow-none">
    <div class="font-display text-4xl tracking-tight text-power sm:text-5xl">
      <span
        class="counter"
        data-target={target}
        data-start={start}
        data-decimals={decimals}
        data-suffix={suffix}
      >
        0
      </span>
    </div>
    <div class="mt-1 text-neutral-600 dark:text-neutral-400">{label}</div>
    <div class="mt-2 text-xs text-neutral-500 dark:text-neutral-600">{description}</div>
  </div>
);
