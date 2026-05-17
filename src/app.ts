import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { secureHeaders } from "hono/secure-headers";

import { configuration } from "./configuration";
import type { AppContext } from "./context";
import { layoutRenderer } from "./routes/_layouts/renderer";
import { createMiddleware } from "./routes/middleware";
import { createMainRouter } from "./routes/routes";

export type HonoApp = OpenAPIHono;

export function createApp(context: AppContext): HonoApp {
  const middleware = createMiddleware(context.helpers, context.logger);

  const app = new OpenAPIHono();

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
  app.use("*", compress());
  app.use("*", etag());
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
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cloudflareinsights.com"],
        fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    }),
  );

  app.use("/css/*", serveStatic({ root: "./public" }));
  app.use("/js/*", serveStatic({ root: "./public" }));
  app.use("/img/*", serveStatic({ root: "./public" }));
  app.use("/fonts/*", serveStatic({ root: "./public" }));
  app.use("/robots.txt", serveStatic({ path: "./public/robots.txt" }));

  app.use("*", middleware.appLocalStateMiddleware);
  app.use("*", layoutRenderer);
  app.use("*", middleware.rateLimitMiddleware);

  app.route("/", createMainRouter(context));

  app.doc("/docs/api.json", {
    openapi: "3.1.0",
    info: {
      title: "close-powerlifting API",
      version: configuration.app.version,
      description:
        "An in-memory REST API mirroring the OpenPowerlifting dataset. All endpoints are anonymous and read-only.",
    },
    servers: [{ url: "/" }],
  });
  app.get("/docs/api", swaggerUI({ url: "/docs/api.json" }));

  app.notFound(middleware.notFoundHandler);
  app.onError(middleware.errorHandler);

  return app;
}
