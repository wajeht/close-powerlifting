import { createContext } from "./context";
import { createServer, closeServer, ServerInfo } from "./app";

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

async function main(): Promise<void> {
  const serverInfo = createServer(context);
  process.title = "close-powerlifting";

  process.on("SIGINT", () => gracefulShutdown("SIGINT", serverInfo));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", serverInfo));
  process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT", serverInfo));

  process.on("warning", handleWarning);
  process.on("uncaughtException", handleUncaughtException);
  process.on("unhandledRejection", handleUnhandledRejection);
}

main().catch((error: Error) => {
  context.logger.error("Failed to start server", error);
  process.exit(1);
});
