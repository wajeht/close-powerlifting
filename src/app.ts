import compression from "compression";
import flash from "connect-flash";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express } from "express";
import helmet from "helmet";
import path from "path";
import { Server } from "http";
import { AddressInfo } from "net";

import { config } from "./config";
import { Middleware } from "./routes/middleware";
import { MainRouter } from "./routes/routes";
import { expressJSDocSwaggerHandler } from "./utils/swagger";
import { engine, layoutMiddleware } from "./utils/template";
import { Database } from "./db/db";
import { AdminUser } from "./utils/admin-user";
import { CronService } from "./crons";
import { Logger } from "./utils/logger";

export interface ServerInfo {
  app: Express;
  server: Server;
}

export function createApp(): { app: Express } {
  const middleware = Middleware();

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
        origin: config.app.env === "production" ? config.app.domain : true,
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
    .engine("html", engine)
    .set("view engine", "html")
    .set("views", path.resolve(path.join(process.cwd(), "src", "routes")))
    .set("view cache", config.app.env === "production")
    .use(layoutMiddleware)
    .use(middleware.rateLimitMiddleware())
    .use(MainRouter());

  expressJSDocSwaggerHandler(app);

  app.use(middleware.notFoundMiddleware).use(middleware.errorMiddleware);

  return { app };
}

export function createServer(): ServerInfo {
  const database = Database();
  const cronService = CronService();
  const adminUser = AdminUser();
  const logger = Logger();

  const { app } = createApp();

  const server: Server = app.listen(config.app.port);

  server.on("listening", async () => {
    const addr: string | AddressInfo | null = server.address();
    const bind: string =
      typeof addr === "string" ? "pipe " + addr : "port " + (addr as AddressInfo).port;

    logger.info(`Server is listening on ${bind}`);

    try {
      await database.init();
      cronService.start();
      await adminUser.initAdminUser();
    } catch (error) {
      logger.error((error as any).message);
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    const bind: string =
      typeof config.app.port === "string" ? "Pipe " + config.app.port : "Port " + config.app.port;

    switch (error.code) {
      case "EACCES":
        logger.error(`${bind} requires elevated privileges`);
        process.exit(1);
      case "EADDRINUSE":
        logger.error(`${bind} is already in use`);
        process.exit(1);
      default:
        throw error;
    }
  });

  return { app, server };
}

export async function closeServer({ server }: ServerInfo): Promise<void> {
  const database = Database();
  const cronService = CronService();
  const logger = Logger();

  logger.info("Shutting down server gracefully");

  cronService.stop();

  try {
    await database.stop();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error("Error closing database connection", error);
  }

  await new Promise<void>((resolve, reject) => {
    const shutdownTimeout = setTimeout(() => {
      logger.error("Could not close connections in time, forcefully shutting down");
      reject(new Error("Server close timeout"));
    }, 10000);

    server.close((error) => {
      clearTimeout(shutdownTimeout);
      if (error) {
        logger.error("Error closing HTTP server", error);
        reject(error);
      } else {
        logger.info("HTTP server closed");
        resolve();
      }
    });
  });

  logger.info("Server shutdown complete");
}
