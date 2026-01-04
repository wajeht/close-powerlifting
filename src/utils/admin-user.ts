import bcrypt from "bcryptjs";

import { config } from "../config";
import type { UserRepositoryType } from "../db/user";
import type { HelpersType } from "./helpers";
import type { AuthServiceType } from "../routes/auth/auth.service";
import type { MailType } from "../mail";
import type { LoggerType } from "./logger";

export interface AdminUserType {
  initializeAdminUser: () => Promise<void>;
}

export function createAdminUser(
  userRepository: UserRepositoryType,
  helpers: HelpersType,
  authService: AuthServiceType,
  mail: MailType,
  logger: LoggerType,
): AdminUserType {
  async function initializeAdminUser() {
    try {
      const found = await userRepository.findByEmail(config.app.adminEmail);

      if (!found) {
        logger.info("admin user does not exist");
        logger.info("attaching admin user");

        const password = helpers.generatePassword();
        const hashedPassword = await bcrypt.hash(password, parseInt(config.app.passwordSalt));
        const { key: token } = await helpers.hashKey();

        const createdAdminUser = await userRepository.create({
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

        const { hashedKey, unhashedKey } = await helpers.generateAPIKey({
          name: createdAdminUser.name,
          userId: String(createdAdminUser.id),
          email: createdAdminUser.email,
          admin: true,
        });

        await authService.updateUser(createdAdminUser.email, { key: hashedKey });

        await mail.sendAdminCredentialsEmail({
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

  return {
    initializeAdminUser,
  };
}
