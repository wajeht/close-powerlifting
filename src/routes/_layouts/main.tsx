import type { FC, PropsWithChildren } from "hono/jsx";

export interface AppState {
  domain: string;
  currentYear: number;
  env: string;
  routeHealth: boolean | null;
}

export interface PageProps {
  state: AppState;
  path: string;
}

interface LayoutProps extends PageProps {
  title?: string;
}

export const MainLayout: FC<PropsWithChildren<LayoutProps>> = ({
  title,
  state,
  path,
  children,
}) => (
  <html lang="en">
    <Head title={title} state={state} />
    <body class="flex min-h-screen flex-col bg-black text-neutral-500">
      <Header state={state} path={path} />
      <main id="main" class="flex-1 px-5 py-16">
        <div class="mx-auto max-w-7xl">{children}</div>
      </main>
      <Footer state={state} />
    </body>
  </html>
);

const Head: FC<{ title?: string; state: AppState }> = ({ title, state }) => (
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin="anonymous" />
    <link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
    <link rel="preconnect" href="https://cloudflareinsights.com" crossorigin="anonymous" />
    <link rel="dns-prefetch" href="https://cloudflareinsights.com" />

    <title>{title ? `Close Powerlifting - ${title}` : "Close Powerlifting"}</title>

    <meta name="description" content="An intuitive REST API for the OpenPowerlifting database" />
    <meta name="keywords" content="powerlifting, squat, bench, deadlift, open-powerlifting, api" />
    <meta name="author" content="wajeht" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content={`https://${state.domain}`} />
    <meta property="og:title" content="Close Powerlifting" />
    <meta
      property="og:description"
      content="An intuitive REST API for the OpenPowerlifting database"
    />
    <meta property="og:image" content={`https://${state.domain}/img/og.png`} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content={`https://${state.domain}`} />
    <meta property="twitter:title" content="Close Powerlifting" />
    <meta
      property="twitter:description"
      content="An intuitive REST API for the OpenPowerlifting database"
    />
    <meta property="twitter:image" content={`https://${state.domain}/img/og.png`} />

    <link
      rel="icon"
      href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏋🏻</text></svg>"
    />
    <link rel="stylesheet" href="/css/style.css" />

    <style>{ANIMATIONS_CSS}</style>
  </head>
);

const ANIMATIONS_CSS = `
.fade-in-heading { animation: fadeInDown 0.4s forwards; opacity: 0; }
.fade-in { animation: fadeIn 0.4s forwards; opacity: 0; }
.animation-delay-1 { animation-delay: 50ms; }
.animation-delay-2 { animation-delay: 100ms; }
.animation-delay-3 { animation-delay: 150ms; }
.animation-delay-4 { animation-delay: 200ms; }
.animation-delay-5 { animation-delay: 250ms; }
.animation-delay-6 { animation-delay: 300ms; }
.animation-delay-7 { animation-delay: 350ms; }
.animation-delay-8 { animation-delay: 400ms; }
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

const Header: FC<PageProps> = ({ state, path }) => (
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

const GitHubIcon: FC = () => (
  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56 0-.27-.01-1.18-.02-2.14-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

const HealthDot: FC<{ health: boolean | null }> = ({ health }) => {
  if (health === true) {
    return (
      <span
        class="pointer-events-none absolute right-[-10px] top-[-1px] inline-flex h-1.5 w-1.5"
        aria-label="All systems operational"
        title="All systems operational"
      >
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
        <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
    );
  }
  if (health === false) {
    return (
      <span
        class="pointer-events-none absolute right-[-10px] top-[-1px] inline-block h-1.5 w-1.5 rounded-full bg-power"
        aria-label="Service degraded"
        title="Service degraded"
      />
    );
  }
  return null;
};

const linkClass = (active: boolean) =>
  `${active ? "text-white" : "text-neutral-400"} inline-flex h-8 items-center transition-colors hover:text-white`;

const DesktopNav: FC<PageProps> = ({ state, path }) => (
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

const MobileNav: FC<PageProps> = ({ state, path }) => (
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

const Footer: FC<{ state: AppState }> = ({ state }) => (
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
