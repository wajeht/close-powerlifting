import { describe, expect, test, vi } from 'vitest';

import { getRankings } from '../api/rankings/rankings.services';
import { hashKey } from '../utils/helpers';
import { getHostName } from '../utils/helpers';
import { getHomePage, getRegisterPage, postRegisterPage } from './views.controllers';
import { User } from './views.models';
import { sendVerificationEmail } from './views.services';

// vi.mock('./views.services', async () => ({
//   ...((await import('./views.services')) as object),
//   sendVerificationEmail: vi.fn(),
// }));

// vi.mock('../utils/helpers', async () => ({
//   ...((await import('../utils/helpers')) as object),
//   hashKey: vi.fn(),
//   getHostName: vi.fn(),
// }));

vi.mock('../api/rankings/rankings.services', async () => ({
  ...((await import('../api/rankings/rankings.services')) as object),
  getRankings: vi.fn(),
}));

vi.mock('./views.models', async () => ({
  ...((await import('./views.models')) as object),
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

describe('getHomePage', () => {
  test('returns home page', async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getRankings.mockResolvedValueOnce([]);

    await getHomePage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('home.html', {
      path: '/home',
      rankings: [],
    });
  });
});

describe('getRegisterPage', () => {
  test('returns register page', async () => {
    const req = {
      flash: vi.fn(() => []),
    } as any;

    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getRegisterPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('register.html', {
      path: '/register',
      messages: req.flash(),
    });
  });
});

describe('postRegisterPage', () => {
  test('should be able to register a user', async () => {
    const req = {
      body: {
        email: 'jaw@jaw.com',
        name: 'jaw',
      },
      get: vi.fn(() => ''),
      flash: vi.fn(() => []),
    } as any;

    const res = {
      status: vi.fn(),
      render: vi.fn(),
      redirect: vi.fn(),
    } as any;

    User.findOne.mockResolvedValueOnce({
      id: 1,
    });

    User.create.mockResolvedValueOnce({
      id: 1,
    });

    // hashKey.mockResolvedValueOnce({ key: '' });

    // sendVerificationEmail.mockResolvedValueOnce();

    // getHostName.mockReturnValueOnce('localhost');

    await postRegisterPage(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/register');
  });
});
