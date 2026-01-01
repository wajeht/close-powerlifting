import { AddressInfo } from "net";
import { Server } from "http";

import app from "./app";
import { appConfig } from "./config/constants";
import * as db from "./db/db";
import * as admin from "./utils/admin-user";
import * as crons from "./utils/crons";
import logger from "./utils/logger";

const server: Server = app.listen(appConfig.port);

server.on("listening", async () => {
  const addr: string | AddressInfo | null = server.address();
  const bind: string =
    typeof addr === "string" ? "pipe " + addr : "port " + (addr as AddressInfo).port;

  logger.info(`Server is listening on ${bind}`);

  try {
    await db.init();
    await crons.init();
    await admin.init();
  } catch (error) {
    logger.error((error as any).message);
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind: string =
    typeof appConfig.port === "string" ? "Pipe " + appConfig.port : "Port " + appConfig.port;

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

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully.`);

  server.close(async () => {
    logger.info("HTTP server closed.");

    try {
      await db.stop();
      logger.info("Database connection closed.");
    } catch (error) {
      logger.error({ err: error }, "Error closing database connection");
    }

    logger.info("All connections closed successfully.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT"));

process.on("uncaughtException", async (error: Error, origin: string) => {
  logger.error({ err: error, origin }, "Uncaught Exception");
  gracefulShutdown("uncaughtException");
});

process.on("warning", (warning: Error) => {
  logger.warn({ name: warning.name, message: warning.message }, "Process warning");
});

process.on("unhandledRejection", async (reason: unknown, promise: Promise<unknown>) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
  gracefulShutdown("unhandledRejection");
});
