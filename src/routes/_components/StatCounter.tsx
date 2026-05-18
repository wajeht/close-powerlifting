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
  <div class="group relative flex flex-col items-center gap-3 border-t-2 border-power pt-6 text-center">
    <div class="font-display text-6xl leading-none tracking-tight text-power sm:text-7xl lg:text-8xl">
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
    <div class="font-medium text-neutral-900 dark:text-white">{label}</div>
    <div class="text-sm text-neutral-500">{description}</div>
  </div>
);
