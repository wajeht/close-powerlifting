import { serve, type ServerType } from "@hono/node-server";

import { createApp, type HonoApp } from "./app";
import { configuration } from "./configuration";
import { createContext, type AppContext } from "./context";
import { warmRouteStatuses } from "./routes/api/health-check/health-check.service";

export interface ServerInfo {
  app: HonoApp;
  server: ServerType;
  context: AppContext;
}

const context = createContext();

async function gracefulShutdown(signal: string, serverInfo: ServerInfo): Promise<void> {
  context.logger.info(`Received ${signal}, shutting down gracefully.`);

  setTimeout(() => {
    context.logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();

  try {
    await closeServer(serverInfo);
    process.exit(0);
  } catch (error) {
    context.logger.error("Error during shutdown", error);
    process.exit(1);
  }
}

function handleWarning(warning: Error): void {
  context.logger.warn(`Process warning: ${warning.name} - ${warning.message}`);
}

function handleUncaughtException(error: Error, origin: string): void {
  context.logger.error(`Uncaught Exception: ${origin}`, error);
  process.exit(1);
}

function handleUnhandledRejection(reason: unknown): void {
  context.logger.error("Unhandled Rejection", reason);
  process.exit(1);
}

export function createServer(context: AppContext): ServerInfo {
  const app = createApp(context);
  const server = serve({ fetch: app.fetch, port: configuration.app.port }, (info) => {
    context.logger.info("=".repeat(50));
    context.logger.info(`Server running at http://localhost:${info.port}`);
    context.logger.info("=".repeat(50));
  });
  return { app, server, context };
}

export async function closeServer({ server, context }: ServerInfo): Promise<void> {
  context.logger.info("Shutting down server gracefully");
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

async function main(): Promise<void> {
  process.title = "close-powerlifting";

  process.on("warning", handleWarning);
  process.on("uncaughtException", handleUncaughtException);
  process.on("unhandledRejection", handleUnhandledRejection);

  const serverInfo = createServer(context);

  process.on("SIGINT", () => gracefulShutdown("SIGINT", serverInfo));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", serverInfo));
  process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT", serverInfo));

  void context.store
    .load()
    .then((result) => {
      context.logger.info(
        `store: initial load complete in ${result.durationMs}ms ` +
          `(rows=${result.rowCount}, last-modified=${result.sourceLastModified ?? "unknown"})`,
      );
      warmRouteStatuses(`http://127.0.0.1:${configuration.app.port}`);
    })
    .catch((error: Error) => {
      context.logger.error("store: initial load failed", error);
      process.exit(1);
    });
}

main().catch((error: Error) => {
  context.logger.error("Failed to start server", error);
  process.exit(1);
});
