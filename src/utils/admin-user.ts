import bcrypt from "bcryptjs";

import { config } from "../config";
import * as UserRepository from "../db/repositories/user.repository";
import { generateAPIKey, generatePassword, hashKey } from "../utils/helpers";
import { updateUser } from "../routes/auth/auth.service";
import logger from "./logger";
import mail from "./mail";
import adminNewAPIKeyHTML from "./templates/admin-new-api-key";

export async function init() {
  try {
    const found = await UserRepository.findByEmail(config.app.adminEmail);

    if (!found) {
      logger.info("admin user does not exist");
      logger.info("attaching admin user");

      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, parseInt(config.app.passwordSalt));
      const { key: token } = await hashKey();

      const createdAdminUser = await UserRepository.create({
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

      const verified = await updateUser(createdAdminUser.email, { key: hashedKey });

      mail.sendMail({
        from: `"Close Powerlifting" <${config.app.adminEmail}>`,
        to: createdAdminUser.email,
        subject: "API Key and Admin Password for Close Powerlifting",
        html: adminNewAPIKeyHTML({ name: verified.name, password, apiKey: unhashedKey }),
      });

      logger.info(
        `admin user: ${config.app.adminEmail} - ${config.app.adminEmail} has been attached!`,
      );

      return;
    }

    logger.info("admin user exits");
    logger.info("skipping admin user attaching");
  } catch (e) {
    logger.error(e);
  }
}
