import type { FC, PropsWithChildren } from "hono/jsx";

import { Footer } from "../_components/Footer";
import { Head } from "../_components/Head";
import { Header } from "../_components/Header";

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
