import { configuration } from "../configuration";
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
      const found = await userRepository.findByEmail(configuration.app.adminEmail);

      if (!found) {
        logger.info("admin user does not exist");
        logger.info("attaching admin user");

        const { key: token } = await helpers.hashKey();

        const createdAdminUser = await userRepository.create({
          email: configuration.app.adminEmail,
          name: helpers.extractNameFromEmail(configuration.app.adminEmail),
          admin: true,
          verification_token: token,
          verified: true,
          verified_at: new Date().toISOString(),
        });

        logger.info(``);
        logger.info(``);
        logger.info(`admin user has been created.`);
        logger.info(`email: ${configuration.app.adminEmail}`);
        logger.info(`Admin can log in via magic link sent to this email.`);
        logger.info(``);
        logger.info(``);

        const { hashedKey, unhashedKey } = await helpers.generateAPIKey({
          name: createdAdminUser.name,
          userId: String(createdAdminUser.id),
          email: createdAdminUser.email,
          admin: true,
        });

        await authService.updateUser(createdAdminUser.email, { key: hashedKey });

        await mail.sendWelcomeEmail({
          email: createdAdminUser.email,
          name: createdAdminUser.name,
          key: unhashedKey,
        });

        logger.info(
          `admin user: ${configuration.app.adminEmail} - ${configuration.app.adminEmail} has been attached!`,
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
