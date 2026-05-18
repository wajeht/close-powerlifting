import type { FC } from "hono/jsx";

// Tiny inline handler attached to the button. Defined once per page so we
// can wire it without a separate JS bundle. Reads the current class on
// <html>, flips it, and writes the result to localStorage so subsequent
// page loads pick up the same choice via Head's FOUC-prevention script.
const TOGGLE_SCRIPT = `(function(){var root=document.documentElement;var isDark=root.classList.toggle('dark');try{localStorage.setItem('theme',isDark?'dark':'light');}catch(e){}})();`;

export const ThemeToggle: FC = () => (
  <button
    type="button"
    onclick={TOGGLE_SCRIPT}
    aria-label="Toggle color theme"
    title="Toggle color theme"
    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 transition-all hover:border-power hover:text-power dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-power dark:hover:text-power"
  >
    {/* Moon: visible in light mode, hidden in dark */}
    <svg
      class="h-3.5 w-3.5 dark:hidden"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      />
    </svg>
    {/* Sun: visible in dark mode, hidden in light */}
    <svg
      class="hidden h-3.5 w-3.5 dark:block"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
      />
    </svg>
  </button>
);
