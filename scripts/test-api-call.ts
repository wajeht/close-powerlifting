import { configuration } from "../src/configuration";
import { createLogger } from "../src/utils/logger";

const logger = createLogger();

async function main() {
  try {
    const response = await fetch(`https://close-powerlifting.jaw.dev/api/rankings`, {
      headers: {
        Authorization: `Bearer ${configuration.app.apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch API: ${response.statusText}`);
    }
    const data = await response.json();
    logger.info(`Response: ${JSON.stringify(data, null, 2)}`);
    return data;
  } catch (error) {
    logger.error("Error testing API call:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Test API call failed:", error);
  process.exit(1);
});
