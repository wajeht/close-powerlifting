import { buildDatabase } from "../src/data/database-builder";
import { createLogger } from "../src/utils/logger";

const logger = createLogger();

buildDatabase(logger).catch((error: unknown) => {
  logger.error("build-database: failed", error);
  process.exit(1);
});
