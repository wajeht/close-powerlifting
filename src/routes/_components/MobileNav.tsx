import type { FC } from "hono/jsx";

import type { PageProps } from "../_layouts/main";
import { GitHubIcon } from "./GitHubIcon";
import { HealthDot } from "./HealthDot";
import { linkClass } from "./_utils";

export const MobileNav: FC<PageProps> = ({ state, path }) => (
  <div class="relative flex sm:hidden">
    <input type="checkbox" id="mobile-menu-toggle" class="peer hidden" />
    <label for="mobile-menu-toggle" class="cursor-pointer p-2">
      <svg
        class="h-6 w-6 peer-checked:hidden"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </label>
    <div class="fixed inset-0 z-[100] hidden h-screen w-screen bg-black peer-checked:block">
      <div class="flex w-full items-center justify-between p-5">
        <h1 class="text-2xl font-extrabold text-white hover:text-neutral-300">
          <a href="/">Close Powerlifting</a>
        </h1>
        <label for="mobile-menu-toggle" class="cursor-pointer p-2">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </label>
      </div>
      <nav class="mx-5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-8">
        <ul class="flex flex-col items-center gap-5">
          <li>
            <a class={linkClass(path === "/about")} href="/about">
              About
            </a>
          </li>
          <li class="relative">
            <a class={linkClass(path === "/status")} href="/status">
              Status
            </a>
            <HealthDot health={state.routeHealth} />
          </li>
          <li>
            <a
              class="inline-flex h-8 items-center text-neutral-400 hover:text-white"
              href="/docs/api"
              target="_blank"
            >
              Docs
            </a>
          </li>
          <li class="pt-2">
            <a
              class="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-700 px-3 text-neutral-300 transition-all hover:border-power hover:text-white"
              href="https://github.com/wajeht/close-powerlifting"
              target="_blank"
              rel="noopener"
              aria-label="GitHub"
            >
              <GitHubIcon />
              GitHub
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </div>
);
