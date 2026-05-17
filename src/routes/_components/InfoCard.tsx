import type { FC } from "hono/jsx";

interface InfoCardProps {
  label: string;
  value: string;
}

export const InfoCard: FC<InfoCardProps> = ({ label, value }) => (
  <article class="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-all hover:border-power/50">
    <div class="text-sm text-neutral-400">{label}</div>
    <div class="mt-1 text-xl font-semibold text-white">{value || "—"}</div>
  </article>
);
