import type { FC } from "hono/jsx";

const TOGGLE_SCRIPT = `(function(){var root=document.documentElement;var isDark=root.classList.toggle('dark');try{localStorage.setItem('theme',isDark?'dark':'light');}catch(e){}})();`;

export const ThemeToggle: FC = () => (
  <button
    type="button"
    onclick={TOGGLE_SCRIPT}
    aria-label="Toggle color theme"
    class="cursor-pointer text-neutral-600 hover:text-power dark:text-neutral-400 dark:hover:text-power"
  >
    <span class="dark:hidden">Switch to dark</span>
    <span class="hidden dark:inline">Switch to light</span>
  </button>
);
