import { describe, expect, test, vi } from 'vitest';

import { hashKey } from '../../utils/helpers';
import { User } from '../../views/views.models';
import { getGoogle, postRegister } from './auth.controllers';

vi.mock('../../utils/helpers', () => ({
  getGoogleOAuthURL: vi.fn().mockReturnValue('mock-url'),
  hashKey: vi.fn(),
  getHostName: vi.fn(),
}));

vi.mock('../../views/views.models', async () => ({
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../api.errors', async () => ({
  UnauthorizedError: vi.fn(),
  ValidationError: vi.fn(),
}));

describe('getGoogle', () => {
  let req = {} as any;
  let res = {
    redirect: vi.fn(),
  } as any;

  test('redirects to google o auth url', async () => {
    await getGoogle(req, res);
    expect(res.redirect).toHaveBeenCalledWith('mock-url');
  });
});

describe('postRegister', async () => {
  test('should be able to register a user', async () => {
    const req = {
      body: {
        email: 'jaw@jaw.com',
        name: 'jaw',
      },
    } as any;

    const res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    } as any;

    hashKey.mockReturnValue({ key: 'mock-key' });

    User.create.mockReturnValue({ id: 'mock-id' });

    await postRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
