import type { FC } from "hono/jsx";

interface StatusBannerProps {
  ready: boolean;
  allGood: boolean;
  rowCount: number;
}

export const StatusBanner: FC<StatusBannerProps> = ({ ready, allGood, rowCount }) => {
  if (!ready) {
    return (
      <div class="fade-in animation-delay-2 flex items-start gap-3 rounded-lg border border-power/30 bg-power/10 p-4">
        <svg
          class="mt-0.5 h-5 w-5 flex-shrink-0 text-power"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex flex-col gap-1">
          <span class="font-medium text-power">Warming Up</span>
          <p class="text-sm text-neutral-300">
            Snapshot is still loading. API endpoints return 503 until ready.
          </p>
        </div>
      </div>
    );
  }
  if (allGood) {
    return (
      <div class="fade-in animation-delay-2 flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <svg
          class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <div class="flex flex-col gap-1">
          <span class="font-medium text-green-400">All Systems Operational</span>
          <p class="text-sm text-neutral-300">
            {rowCount.toLocaleString()} entries loaded in memory; all endpoints are serving
            responses.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div class="fade-in animation-delay-2 flex items-start gap-3 rounded-lg border border-power/30 bg-power/10 p-4">
      <svg
        class="mt-0.5 h-5 w-5 flex-shrink-0 text-power"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <div class="flex flex-col gap-1">
        <span class="font-medium text-power">Service Degraded</span>
        <p class="text-sm text-neutral-300">
          Some endpoints are experiencing issues. Open the cards below for details.
        </p>
      </div>
    </div>
  );
};
