import type { FC } from "hono/jsx";

import type { PageProps } from "../_layouts/main";
import { GitHubIcon } from "./GitHubIcon";
import { HealthDot } from "./HealthDot";
import { ThemeToggle } from "./ThemeToggle";
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
    <div class="fixed inset-0 z-[100] hidden h-screen w-screen bg-stone-50 peer-checked:block dark:bg-black">
      <div class="flex w-full items-center justify-between p-5">
        <h1 class="font-display text-xl tracking-tight text-neutral-900 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300">
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
      <nav class="card-lift mx-5 rounded-lg border border-neutral-200/70 bg-white px-3 py-8 dark:border-neutral-800 dark:bg-neutral-900">
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
              class="inline-flex h-8 items-center text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              href="/docs/api"
              target="_blank"
            >
              Docs
            </a>
          </li>
          <li>
            <ThemeToggle />
          </li>
          <li class="pt-2">
            <a
              class="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-300 px-3 text-neutral-600 transition-all hover:border-power hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-white"
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
