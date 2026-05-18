import type { FC } from "hono/jsx";

interface InfoCardProps {
  label: string;
  value: string;
}

export const InfoCard: FC<InfoCardProps> = ({ label, value }) => (
  <article class="card-lift rounded-lg border border-neutral-200/70 bg-white p-4 transition-all hover:border-power/50 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:shadow-none">
    <div class="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
    <div class="mt-1 text-xl font-semibold text-neutral-900 dark:text-white">{value || "—"}</div>
  </article>
);
