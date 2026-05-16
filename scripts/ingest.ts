import { createContext } from "../src/context";

async function main(): Promise<void> {
  const context = createContext();
  await context.database.init();

  try {
    const result = await context.ingest.runNightly();
    context.logger.info(
      `ingest finished: status=${result.status} rows=${result.rowCount} durationMs=${result.durationMs}`,
    );
    process.exitCode = result.status === "failed" ? 1 : 0;
  } finally {
    await context.database.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
