import bcrypt from 'bcryptjs';
import { User } from '../views/views.models';
import { ADMIN, PASSWORD_SALT, JWT_SECRET, EMAIL } from '../config/constants';
import logger from './logger';
import jwt from 'jsonwebtoken';
import { faker } from '@faker-js/faker';
import { hashKey } from '../utils/helpers';
import mail from './mail';

export async function init() {
  try {
    logger.info('**** attaching admin user ****');

    const found = await User.findOne({ email: ADMIN.EMAIL });

    if (!found) {
      const password = faker.internet.password(50);
      const hashedPassword = await bcrypt.hash(password, parseInt(PASSWORD_SALT!));
      const { key: token } = await hashKey();

      const created = await User.create({
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
      logger.info(`**** admin user has been created with the following credentials! ****`);
      logger.info(`**** email: ${ADMIN.EMAIL} ****`);
      logger.info(`**** password: ${password} ****`);
      logger.info(``);
      logger.info(``);

      const apiKey = jwt.sign(
        {
          id: created.id,
          name: created.name,
          email: created.email,
        },
        JWT_SECRET!,
        {
          issuer: 'Close Powerlifting',
        },
      );

      const hashedApiKey = await bcrypt.hash(apiKey, parseInt(PASSWORD_SALT!));

      let verified = await User.findOneAndUpdate(
        {
          email: created.email,
        },
        {
          $set: {
            key: hashedApiKey,
          },
        },
        {
          returnOriginal: false,
        },
      );

      const info = await mail.sendMail({
        from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
        to: created.email,
        subject: 'API Key and Admin Password for Close Powerlifting',
        html: `
          <div>
            <p>Hi ${verified!.name},</p>
            <br>
            <p>Here below is your API key and admin password to access Close Powerlifting!</p>
            <br>
            <br>
            <p>Admin password</p>
            <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${password}</div>
            <br>
            <p>API Key:</p>
            <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${apiKey}</div>
            <br>
            <br>
            <br>
            <p>Welcome to the Close Powerlifting,</p>
            <p>Let's make all kinds of gains. All kindszzzz.!</p>
          </div>
          `,
      });

      logger.info(`**** admin user: ${ADMIN.EMAIL} - ${ADMIN.EMAIL} has been attached! ****`);
    }
  } catch (e) {
    logger.error(e);
  }
}
