import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";

import { configuration } from "./configuration";
import type { AppContext } from "./context";
import { layoutRenderer } from "./routes/_layouts/renderer";
import { createMiddleware } from "./routes/middleware";
import { createMainRouter } from "./routes/routes";

export type HonoApp = OpenAPIHono;

const STATIC_CACHE_CONTROL = "public, max-age=2592000, immutable"; // 30 days

export function createApp(context: AppContext): HonoApp {
  const middleware = createMiddleware(context.helpers, context.logger);

  const app = new OpenAPIHono();

  // Normalize `/foo/` -> `/foo` before anything else looks at the path.
  app.use(trimTrailingSlash());

  app.use("*", requestId());
  app.use("*", middleware.hostNameMiddleware);
  app.use("*", middleware.requestLoggerMiddleware);
  app.use(
    "*",
    cors({
      credentials: true,
      origin: (origin) => {
        if (configuration.app.env !== "production") return origin ?? "*";
        return origin === configuration.app.domain ? origin : configuration.app.domain;
      },
    }),
  );
  // Static assets — 30d browser cache. Container images rebuild from scratch
  // every deploy so cache-busting comes from new image revisions, not query
  // string fingerprints. Mounted BEFORE compress/etag/prettyJSON so binary
  // files (images, fonts) skip body-buffering middlewares.
  const onStaticFound = (_path: string, c: import("hono").Context) =>
    c.header("Cache-Control", STATIC_CACHE_CONTROL);
  app.use("/css/*", serveStatic({ root: "./public", onFound: onStaticFound }));
  app.use("/js/*", serveStatic({ root: "./public", onFound: onStaticFound }));
  app.use("/img/*", serveStatic({ root: "./public", onFound: onStaticFound }));
  app.use("/fonts/*", serveStatic({ root: "./public", onFound: onStaticFound }));
  app.use("/robots.txt", serveStatic({ path: "./public/robots.txt" }));

  app.use("*", compress());
  app.use("*", etag());
  app.use("*", prettyJSON());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://static.cloudflareinsights.com",
          "https://cdn.jsdelivr.net",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cloudflareinsights.com"],
        fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    }),
  );

  app.use("*", middleware.appLocalStateMiddleware);
  app.use("*", layoutRenderer);
  app.use("*", middleware.rateLimitMiddleware);

  app.route("/", createMainRouter(context));

  app.doc("/docs/api.json", {
    openapi: "3.1.0",
    info: {
      title: "close-powerlifting API",
      version: configuration.app.version,
      description: "An intuitive REST API for the OpenPowerlifting dataset.",
    },
    servers: [{ url: "/" }],
  });
  app.get("/docs/api", swaggerUI({ url: "/docs/api.json" }));

  app.notFound(middleware.notFoundHandler);
  app.onError(middleware.errorHandler);

  return app;
}
