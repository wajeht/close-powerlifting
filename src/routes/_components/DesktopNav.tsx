import type { FC } from "hono/jsx";

import type { PageProps } from "../_layouts/main";
import { GitHubIcon } from "./GitHubIcon";
import { HealthDot } from "./HealthDot";
import { linkClass } from "./_utils";

export const DesktopNav: FC<PageProps> = ({ state, path }) => (
  <nav class="hidden sm:block">
    <ul class="flex items-center gap-6">
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
          class="inline-flex h-8 items-center text-neutral-400 transition-colors hover:text-white"
          href="/docs/api"
          target="_blank"
        >
          Docs
        </a>
      </li>
      <li>
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
);
