import bcrypt from "bcryptjs";

import { config } from "../config";
import { findByEmail, create } from "../db/repositories/user.repository";
import { generateAPIKey, generatePassword, hashKey } from "../utils/helpers";
import { updateUser } from "../routes/auth/auth.service";
import { logger } from "./logger";
import { mailService } from "../mail";

export async function initAdminUser() {
  try {
    const found = await findByEmail(config.app.adminEmail);

    if (!found) {
      logger.info("admin user does not exist");
      logger.info("attaching admin user");

      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, parseInt(config.app.passwordSalt));
      const { key: token } = await hashKey();

      const createdAdminUser = await create({
        email: config.app.adminEmail,
        name: config.app.adminName,
        admin: true,
        password: hashedPassword,
        verification_token: token,
        verified: true,
        verified_at: new Date().toISOString(),
      });

      logger.info(``);
      logger.info(``);
      logger.info(`admin user has been created.`);
      logger.info(`email: ${config.app.adminEmail}`);
      logger.info(`A temporary password has been generated and sent to the admin email.`);
      logger.info(``);
      logger.info(``);

      const { hashedKey, unhashedKey } = await generateAPIKey({
        name: createdAdminUser.name,
        userId: String(createdAdminUser.id),
        email: createdAdminUser.email,
        admin: true,
      });

      await updateUser(createdAdminUser.email, { key: hashedKey });

      await mailService.sendAdminCredentialsEmail({
        email: createdAdminUser.email,
        name: createdAdminUser.name,
        password,
        apiKey: unhashedKey,
      });

      logger.info(
        `admin user: ${config.app.adminEmail} - ${config.app.adminEmail} has been attached!`,
      );

      return;
    }

    logger.info("admin user exits");
    logger.info("skipping admin user attaching");
  } catch (e) {
    logger.error(e as Error);
  }
}
