// @ts-expect-error - it's ok
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

import { appConfig } from '../config/constants';
import * as UserRepository from '../db/repositories/user.repository';
import { generateAPIKey, hashKey } from '../utils/helpers';
import { updateUser } from '../views/views.services';
import logger from './logger';
import mail from './mail';
import adminNewAPIKeyHTML from './templates/admin-new-api-key';

export async function init() {
  try {
    const found = await UserRepository.findByEmail(appConfig.admin_email);

    if (!found) {
      logger.info('admin user does not exist');
      logger.info('attaching admin user');

      const password = faker.internet.password(50);
      const hashedPassword = await bcrypt.hash(password, parseInt(appConfig.password_salt!));
      const { key: token } = await hashKey();

      const createdAdminUser = await UserRepository.create({
        email: appConfig.admin_email,
        name: appConfig.admin_name,
        admin: true,
        password: hashedPassword,
        verification_token: token,
        verified: true,
        verified_at: new Date().toISOString(),
      });

      logger.info(``);
      logger.info(``);
      logger.info(`admin user has been created.`);
      logger.info(`email: ${appConfig.admin_email}`);
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
        from: `"Close Powerlifting" <${appConfig.admin_email}>`,
        to: createdAdminUser.email,
        subject: 'API Key and Admin Password for Close Powerlifting',
        html: adminNewAPIKeyHTML({ name: verified.name, password, apiKey: unhashedKey }),
      });

      logger.info(
        `admin user: ${appConfig.admin_email} - ${appConfig.admin_email} has been attached!`,
      );

      return;
    }

    logger.info('admin user exits');
    logger.info('skipping admin user attaching');
  } catch (e) {
    logger.error(e);
  }
}
