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
  <div class="rounded-lg border border-neutral-800 bg-neutral-900 p-6 transition-all hover:border-power/50">
    <div class="text-3xl font-bold text-power">
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
    <div class="mt-1 text-neutral-400">{label}</div>
    <div class="mt-2 text-xs text-neutral-600">{description}</div>
  </div>
);
