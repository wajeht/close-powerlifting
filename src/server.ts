import { logger } from "./utils/logger";
import { createServer, closeServer, ServerInfo } from "./app";

async function gracefulShutdown(signal: string, serverInfo: ServerInfo): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully.`);

  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();

  try {
    await closeServer(serverInfo);
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", error);
    process.exit(1);
  }
}

function handleWarning(warning: Error): void {
  logger.warn(`Process warning: ${warning.name} - ${warning.message}`);
}

function handleUncaughtException(error: Error, origin: string): void {
  logger.error(`Uncaught Exception: ${origin}`, error);
  process.exit(1);
}

function handleUnhandledRejection(reason: unknown): void {
  logger.error("Unhandled Rejection", reason);
  process.exit(1);
}

async function main(): Promise<void> {
  const serverInfo = createServer();
  process.title = "close-powerlifting";

  process.on("SIGINT", () => gracefulShutdown("SIGINT", serverInfo));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", serverInfo));
  process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT", serverInfo));

  process.on("warning", handleWarning);
  process.on("uncaughtException", handleUncaughtException);
  process.on("unhandledRejection", handleUnhandledRejection);
}

main().catch((error: Error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
