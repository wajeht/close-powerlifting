import type { FC } from "hono/jsx";

import type { AppState } from "../_layouts/main";

export const Footer: FC<{ state: AppState }> = ({ state }) => (
  <footer
    id="footer"
    class="border-t border-neutral-200/80 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
  >
    <div class="mx-auto max-w-7xl px-5 py-8">
      <div class="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div class="flex flex-col gap-2">
          <a href="/" class="text-lg font-bold text-neutral-900 hover:text-power dark:text-white">
            Close Powerlifting
          </a>
          <p class="text-sm text-neutral-500">
            A developer-friendly REST API for OpenPowerlifting data.
          </p>
        </div>
        <div class="flex justify-between gap-8 text-sm">
          <div class="flex flex-col gap-2">
            <span class="font-medium text-power">API</span>
            <a
              class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              href="/docs/api"
            >
              Documentation
            </a>
            <a class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white" href="/status">
              Status
            </a>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-medium text-power">Resources</span>
            <a class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white" href="/about">
              About
            </a>
            <a
              class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              href="https://github.com/wajeht/close-powerlifting/issues"
              target="_blank"
            >
              Support
            </a>
            <a
              class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              href="https://github.com/wajeht/close-powerlifting"
              target="_blank"
            >
              GitHub
            </a>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-medium text-power">Legal</span>
            <a
              class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              href="/privacy"
            >
              Privacy
            </a>
            <a class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white" href="/terms">
              Terms
            </a>
          </div>
        </div>
      </div>
      <div class="mt-8 border-t border-neutral-200 pt-6 text-center text-sm text-neutral-500 dark:border-neutral-800">
        <span>
          © {state.currentYear} Close Powerlifting. Made with <span class="text-power">❤️</span> by{" "}
          <a
            class="text-neutral-600 hover:text-power dark:text-neutral-400"
            href="https://github.com/wajeht"
            target="_blank"
          >
            @wajeht
          </a>
        </span>
      </div>
    </div>
  </footer>
);
