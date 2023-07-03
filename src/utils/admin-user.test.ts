import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it, test, vi } from 'vitest';

import { ADMIN, EMAIL, PASSWORD_SALT } from '../config/constants';
import { generateAPIKey, hashKey, updateUser } from '../utils/helpers';
import mail from '../utils/mail';
import { User } from '../views/views.models';
import { init } from './admin-user';
import logger from './logger';

vi.mock('../views/views.models', async () => ({
  ...((await vi.importActual('../views/views.models')) as object),
  User: {
    findOne: vi.fn(),
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
    User.findOne.mockResolvedValueOnce(null);

    faker.internet.password.mockReturnValueOnce('password');

    // bcrypt.hash.mockResolvedValueOnce('hashedPassword');

    await hashKey.mockResolvedValueOnce({ key: 'token' });

    User.create.mockResolvedValueOnce({
      name: ADMIN.NAME,
      id: 'adminId',
      email: ADMIN.EMAIL,
    });

    await generateAPIKey.mockResolvedValueOnce({
      hashedKey: 'hashedKey',
      unhashedKey: 'unhashedKey',
    });

    updateUser.mockResolvedValueOnce({ name: ADMIN.NAME });

    mail.sendMail = vi.fn().mockResolvedValue({});

    await init();

    expect(User.findOne).toHaveBeenCalledWith({ email: ADMIN.EMAIL });
    expect(faker.internet.password).toHaveBeenCalledWith(50);
    // expect(bcrypt.hash).toHaveBeenCalledWith('password', parseInt(PASSWORD_SALT!));
    expect(User.create).toHaveBeenCalledWith({
      email: ADMIN.EMAIL,
      name: ADMIN.NAME,
      admin: true,
      password: expect.any(String),
      verification_token: expect.any(String),
      verified: true,
      verified_at: expect.any(String), // Difficult to test exact date time
    });

    expect(generateAPIKey).toHaveBeenCalledWith({
      name: ADMIN.NAME,
      userId: 'adminId',
      email: ADMIN.EMAIL,
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
    User.findOne.mockResolvedValueOnce({ id: 'existingAdminId' });

    await init();

    expect(User.findOne).toHaveBeenCalledWith({ email: ADMIN.EMAIL });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('should log an error if anything goes wrong', async () => {
    User.findOne.mockRejectedValueOnce(new Error('Error message'));
    const errorSpy = vi.spyOn(logger, 'error');

    await init();

    expect(errorSpy).toHaveBeenCalledWith(new Error('Error message'));
  });
});
