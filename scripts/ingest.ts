import { createContext } from "../src/context";

async function main(): Promise<void> {
  const context = createContext();
  await context.database.init();

  const force = process.argv.includes("--force");
  try {
    const result = await context.ingest.runNightly({ force });
    context.logger.info(
      `ingest finished: status=${result.status} lifts=${result.stats.lifts} lifters=${result.stats.lifters} meets=${result.stats.meets} durationMs=${result.durationMs}`,
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
