import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { etag, RETAINED_304_HEADERS } from "hono/etag";
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
const EXPOSED_RESPONSE_HEADERS = [
  "ETag",
  "RateLimit-Limit",
  "RateLimit-Remaining",
  "RateLimit-Reset",
  "X-Request-Id",
];

export function createApp(context: AppContext): HonoApp {
  const middleware = createMiddleware(context.helpers, context.logger);

  const app = new OpenAPIHono();

  // Normalize `/foo/` -> `/foo` before anything else looks at the path.
  app.use(trimTrailingSlash());

  app.use("*", requestId());
  app.use("*", middleware.hostNameMiddleware);
  app.use("*", middleware.requestLoggerMiddleware);
  // Anonymous public reads must also work from apps hosted on other origins.
  app.use(
    "*",
    cors({
      origin: "*",
      credentials: false,
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      exposeHeaders: EXPOSED_RESPONSE_HEADERS,
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
  // Conditional responses still need CORS and the headers browser clients use.
  app.use(
    "*",
    etag({
      retainedHeaders: [
        ...RETAINED_304_HEADERS,
        "Access-Control-Allow-Origin",
        "Access-Control-Expose-Headers",
        ...EXPOSED_RESPONSE_HEADERS,
      ],
    }),
  );
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
          "https://umami.jaw.dev",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cloudflareinsights.com", "https://umami.jaw.dev"],
        fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
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

  app.doc31("/docs/api.json", {
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
