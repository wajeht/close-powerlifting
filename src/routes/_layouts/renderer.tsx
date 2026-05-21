import { jsxRenderer } from "hono/jsx-renderer";

import { MainLayout } from "./main";

// Hono jsxRenderer wires up `c.render(jsx, { title })` for every route.
// Pages return their inner content; this wraps it in MainLayout with the
// per-request state + active path injected from the global context.
declare module "hono" {
  interface ContextRenderer {
    (content: import("hono/jsx").Child, props?: { title?: string }): Response | Promise<Response>;
  }
}

export const layoutRenderer = jsxRenderer(({ children, title }, c) => (
  <MainLayout state={c.get("state")} path={c.req.path} title={title as string | undefined}>
    {children}
  </MainLayout>
));
