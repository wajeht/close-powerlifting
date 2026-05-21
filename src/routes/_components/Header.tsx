import type { FC } from "hono/jsx";

import type { PageProps } from "../_layouts/main";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

export const Header: FC<PageProps> = ({ state, path }) => (
  <header class="frosted sticky top-0 z-50 p-5">
    <div class="mx-auto flex max-w-7xl items-center justify-between">
      <h1 class="text-2xl font-extrabold text-white hover:text-neutral-300">
        <a href="/" title="Close Powerlifting">
          Close Powerlifting
        </a>
      </h1>
      <DesktopNav state={state} path={path} />
      <MobileNav state={state} path={path} />
    </div>
  </header>
);
