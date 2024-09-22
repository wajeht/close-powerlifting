import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it, Mock, test, vi } from 'vitest';

import { emailConfig, appConfig } from '../config/constants';
import { generateAPIKey, hashKey } from '../utils/helpers';
import mail from '../utils/mail';
import { User } from '../views/views.models';
import { init } from './admin-user';
import logger from './logger';

vi.mock('../views/views.models', async () => ({
  ...((await vi.importActual('../views/views.models')) as object),
  User: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@faker-js/faker', async () => ({
  ...((await vi.importActual('@faker-js/faker')) as object),
  faker: {
    internet: {
      password: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', async () => ({
  ...((await vi.importActual('bcryptjs')) as object),
  bcrypt: {
    hash: vi.fn(),
  },
}));

vi.mock('./helpers', async () => ({
  ...((await vi.importActual('./helpers')) as object),
  generateAPIKey: vi.fn(),
  hashKey: vi.fn(),
  updateUser: vi.fn(),
}));

// vi.mock('./logger', async () => ({
//   ...((await import('./logger')) as object),
//   info: vi.fn().mockImplementation((message: string) => console.log(message)),
//   error: vi.fn().mockImplementation((message: string) => console.log(message)),
// }));

// vi.mock('../utils/mail');

// vi.mock('./mail', async () => ({
//   ...((await vi.importActual('./mail')) as object),
//   mail: {
//     sendMail: vi.fn(),
//   },
// }));

describe('init', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new admin user if one does not exist', async () => {
    (User.findOne as Mock).mockResolvedValueOnce(null);

    (faker.internet.password as Mock).mockReturnValueOnce('password');

    // bcrypt.hash.mockResolvedValueOnce('hashedPassword');

    ((await hashKey) as Mock).mockResolvedValueOnce({ key: 'token' });

    (User.create as Mock).mockResolvedValueOnce({
      name: appConfig.admin_name,
      id: 'adminId',
      email: appConfig.admin_email,
    });

    ((await generateAPIKey) as Mock).mockResolvedValueOnce({
      hashedKey: 'hashedKey',
      unhashedKey: 'unhashedKey',
    });

    // updateUser.mockResolvedValueOnce({ name: appConfig.admin_email });

    mail.sendMail = vi.fn().mockResolvedValue({});

    await init();

    expect(User.findOne).toHaveBeenCalledWith({ email: appConfig.admin_email });
    expect(faker.internet.password).toHaveBeenCalledWith(50);
    // expect(bcrypt.hash).toHaveBeenCalledWith('password', parseInt(PASSWORD_SALT!));
    expect(User.create).toHaveBeenCalledWith({
      email: appConfig.admin_email,
      name: appConfig.admin_name,
      admin: true,
      password: expect.any(String),
      verification_token: expect.any(String),
      verified: true,
      verified_at: expect.any(String), // Difficult to test exact date time
    });

    expect(generateAPIKey).toHaveBeenCalledWith({
      admin: true,
      name: appConfig.admin_name,
      userId: 'adminId',
      email: appConfig.admin_email,
    });

    // expect(updateUser).toHaveBeenCalledWith(ADMIN.EMAIL, { key: 'hashedKey' });

    // expect(mail.sendMail).toHaveBeenCalledWith({
    //   from: expect.any(String),
    //   to: expect.any(String),
    //   subject: expect.any(String),
    //   html: expect.any(String),
    // });
  });

  it('should not create a new admin user if one exists', async () => {
    (User.findOne as Mock).mockResolvedValueOnce({ id: 'existingAdminId' });

    await init();

    expect(User.findOne).toHaveBeenCalledWith({ email: appConfig.admin_email });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('should log an error if anything goes wrong', async () => {
    (User.findOne as Mock).mockRejectedValueOnce(new Error('Error message'));
    const errorSpy = vi.spyOn(logger, 'error');

    await init();

    expect(errorSpy).toHaveBeenCalledWith(new Error('Error message'));
  });
});
