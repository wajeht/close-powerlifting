import compression from "compression";
import flash from "connect-flash";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express } from "express";
import helmet from "helmet";
import path from "path";
import { Server } from "http";
import { AddressInfo } from "net";

import { configuration } from "./configuration";
import { type AppContext } from "./context";
import { createMiddleware } from "./routes/middleware";
import { createMainRouter } from "./routes/routes";
import { createSwagger } from "./utils/swagger";
import { renderTemplate, layoutMiddleware } from "./utils/template";

export interface ServerInfo {
  app: Express;
  server: Server;
  context: AppContext;
}

export function createApp(context: AppContext): { app: Express; context: AppContext } {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
  );

  const app = express();

  app
    .disable("x-powered-by")
    .set("trust proxy", 1)
    .use(middleware.hostNameMiddleware)
    .use(cookieParser())
    .use(flash())
    .use(middleware.sessionMiddleware())
    .use(
      cors({
        credentials: true,
        origin: configuration.app.env === "production" ? configuration.app.domain : true,
      }),
    )
    .use(compression())
    .use(express.json())
    .use(express.urlencoded({ extended: true }))
    .use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"],
          },
        },
      }),
    )
    .use(express.static(path.resolve(path.join(process.cwd(), "public")), { maxAge: "30d" }))
    .engine("html", renderTemplate)
    .set("view engine", "html")
    .set("views", path.resolve(path.join(process.cwd(), "src", "routes")))
    .set("view cache", configuration.app.env === "production")
    .use(layoutMiddleware)
    .use(middleware.rateLimitMiddleware())
    .use(createMainRouter(context));

  createSwagger(app);

  app.use(middleware.notFoundMiddleware).use(middleware.errorMiddleware);

  return { app, context: context };
}

export function createServer(context: AppContext): ServerInfo {
  const { app } = createApp(context);

  const server: Server = app.listen(configuration.app.port);

  server.on("listening", async () => {
    const addr: string | AddressInfo | null = server.address();
    const bind: string =
      typeof addr === "string" ? "pipe " + addr : "port " + (addr as AddressInfo).port;

    context.logger.info(`Server is listening on ${bind}`);

    try {
      await context.database.init();
      context.cron.start();
      await context.adminUser.initializeAdminUser();
    } catch (error) {
      context.logger.error((error as any).message);
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    const bind: string =
      typeof configuration.app.port === "string"
        ? "Pipe " + configuration.app.port
        : "Port " + configuration.app.port;

    switch (error.code) {
      case "EACCES":
        context.logger.error(`${bind} requires elevated privileges`);
        process.exit(1);
      case "EADDRINUSE":
        context.logger.error(`${bind} is already in use`);
        process.exit(1);
      default:
        throw error;
    }
  });

  return { app, server, context: context };
}

export async function closeServer({ server, context }: ServerInfo): Promise<void> {
  context.logger.info("Shutting down server gracefully");

  context.cron.stop();

  try {
    await context.database.stop();
    context.logger.info("Database connection closed");
  } catch (error) {
    context.logger.error("Error closing database connection", error);
  }

  await new Promise<void>((resolve, reject) => {
    const shutdownTimeout = setTimeout(() => {
      context.logger.error("Could not close connections in time, forcefully shutting down");
      reject(new Error("Server close timeout"));
    }, 10000);

    server.close((error) => {
      clearTimeout(shutdownTimeout);
      if (error) {
        context.logger.error("Error closing HTTP server", error);
        reject(error);
      } else {
        context.logger.info("HTTP server closed");
        resolve();
      }
    });
  });

  context.logger.info("Server shutdown complete");
}
