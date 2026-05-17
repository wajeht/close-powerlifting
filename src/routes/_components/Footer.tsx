import type { FC } from "hono/jsx";

import type { AppState } from "../_layouts/main";

export const Footer: FC<{ state: AppState }> = ({ state }) => (
  <footer id="footer" class="border-t border-neutral-800 bg-neutral-900">
    <div class="mx-auto max-w-7xl px-5 py-8">
      <div class="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div class="flex flex-col gap-2">
          <a href="/" class="text-lg font-bold text-white hover:text-power">
            Close Powerlifting
          </a>
          <p class="text-sm text-neutral-500">
            A developer-friendly REST API for OpenPowerlifting data.
          </p>
        </div>
        <div class="flex justify-between gap-8 text-sm">
          <div class="flex flex-col gap-2">
            <span class="font-medium text-power">API</span>
            <a class="text-neutral-500 hover:text-white" href="/docs/api">
              Documentation
            </a>
            <a class="text-neutral-500 hover:text-white" href="/status">
              Status
            </a>
            <a class="text-neutral-500 hover:text-white" href="/api/rankings?limit=10">
              Try It
            </a>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-medium text-power">Resources</span>
            <a class="text-neutral-500 hover:text-white" href="/about">
              About
            </a>
            <a
              class="text-neutral-500 hover:text-white"
              href="https://github.com/wajeht/close-powerlifting/issues"
              target="_blank"
            >
              Support
            </a>
            <a
              class="text-neutral-500 hover:text-white"
              href="https://github.com/wajeht/close-powerlifting"
              target="_blank"
            >
              GitHub
            </a>
          </div>
          <div class="flex flex-col gap-2">
            <span class="font-medium text-power">Legal</span>
            <a class="text-neutral-500 hover:text-white" href="/privacy">
              Privacy
            </a>
            <a class="text-neutral-500 hover:text-white" href="/terms">
              Terms
            </a>
          </div>
        </div>
      </div>
      <div class="mt-8 border-t border-neutral-800 pt-6 text-center text-sm text-neutral-500">
        <span>
          © {state.currentYear} Close Powerlifting. Made with <span class="text-power">❤️</span> by{" "}
          <a
            class="text-neutral-400 hover:text-power"
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
