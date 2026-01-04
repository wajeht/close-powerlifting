import bcrypt from "bcryptjs";

import { configuration } from "../src/configuration";
import { createDatabase } from "../src/db/db";
import { createUserRepository } from "../src/db/user";
import { createLogger } from "../src/utils/logger";

async function main(): Promise<void> {
  if (configuration.app.env === "production") {
    console.error("This script cannot be run in production");
    process.exit(1);
  }

  const logger = createLogger();
  const database = createDatabase(logger);
  const userRepository = createUserRepository(database.instance);

  await database.init();

  const email = process.argv[2];
  const newPassword = process.argv[3] || "password";

  if (!email) {
    logger.info("Usage: npx tsx scripts/password.ts <email> [password]");
    logger.info("  email: User email to reset password for");
    logger.info("  password: New password (default: 'password')");
    await database.stop();
    process.exit(1);
  }

  const user = await userRepository.findByEmail(email);

  if (!user) {
    logger.error(`User not found: ${email}`);
    await database.stop();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, parseInt(configuration.app.passwordSalt));

  await userRepository.update(email, { password: hashedPassword });

  logger.info(`Password reset for ${email}`);
  logger.info(`New password: ${newPassword}`);

  await database.stop();
}

main().catch((error) => {
  console.error("Password reset failed:", error);
  process.exit(1);
});
