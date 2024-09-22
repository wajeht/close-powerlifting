import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

import { ADMIN, EMAIL, PASSWORD_SALT } from '../config/constants';
import { generateAPIKey, hashKey } from '../utils/helpers';
import { User } from '../views/views.models';
import { updateUser } from '../views/views.services';
import logger from './logger';
import mail from './mail';
import adminNewAPIKeyHTML from './templates/admin-new-api-key';

export async function init() {
  try {
    const found = await User.findOne({ email: ADMIN.EMAIL });

    if (!found) {
      logger.info('admin user does not exist');
      logger.info('attaching admin user');

      const password = faker.internet.password(50);
      const hashedPassword = await bcrypt.hash(password, parseInt(PASSWORD_SALT!));
      const { key: token } = await hashKey();

      const createdAdminUser = await User.create({
        email: ADMIN.EMAIL,
        name: ADMIN.NAME,
        admin: true,
        password: hashedPassword,
        verification_token: token,
        verified: true,
        verified_at: new Date().toISOString(),
      });

      logger.info(``);
      logger.info(``);
      logger.info(`admin user has been created with the following credentials! `);
      logger.info(`email: ${ADMIN.EMAIL}`);
      logger.info(`password: ${password}`);
      logger.info(``);
      logger.info(``);

      const { hashedKey, unhashedKey } = await generateAPIKey({
        name: createdAdminUser.name!,
        userId: createdAdminUser.id!,
        email: createdAdminUser.email!,
        admin: true,
      });

      const verified = await updateUser(createdAdminUser.email!, { key: hashedKey });

      mail.sendMail({
        from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
        to: createdAdminUser.email!,
        subject: 'API Key and Admin Password for Close Powerlifting',
        html: adminNewAPIKeyHTML({ name: verified.name!, password, apiKey: unhashedKey }),
      });

      logger.info(`admin user: ${ADMIN.EMAIL} - ${ADMIN.EMAIL} has been attached!`);

      return;
    }

    logger.info('admin user exits');
    logger.info('skipping admin user attaching');
  } catch (e) {
    logger.error(e);
  }
}
