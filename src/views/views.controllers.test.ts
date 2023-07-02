import { describe, expect, test, vi } from 'vitest';

import { getRankings } from '../api/rankings/rankings.services';
import { hashKey } from '../utils/helpers';
import { getHostName } from '../utils/helpers';
import {
  getAboutPage,
  getContactPage,
  getHomePage,
  getPrivacyPage,
  getRegisterPage,
  getResetAPIKeyPage,
  getStatusPage,
  getTermsPage,
  getVerifyEmailPage,
  postRegisterPage,
} from './views.controllers';
import { User } from './views.models';
import { sendWelcomeEmail } from './views.services';

// vi.mock('./views.services', async () => ({
//   ...((await import('./views.services')) as object),
//   sendVerificationEmail: vi.fn(),
// }));

// vi.mock('../utils/helpers', async () => ({
//   ...((await import('../utils/helpers')) as object),
//   hashKey: vi.fn(),
//   getHostName: vi.fn(),
// }));

// vi.mock('./views.services', async () => ({
//   ...((await import('./views.services')) as object),
//   sendWelcomeEmail: vi.fn(),
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

describe('getTermsPage', () => {
  test('returns terms page', async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getTermsPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('terms.html', {
      path: '/terms',
    });
  });
});

describe('getPrivacyPage', () => {
  test('returns privacy page', async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getPrivacyPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('privacy.html', {
      path: '/privacy',
    });
  });
});

describe('getAboutPage', () => {
  test('returns about page', async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getAboutPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('about.html', {
      path: '/about',
    });
  });
});

describe('getStatusPage', () => {
  test('returns status page', async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getStatusPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('status.html', {
      path: '/status',
    });
  });
});

describe('getContactPage', () => {
  test('returns contact page', async () => {
    const req = {
      flash: vi.fn(() => []),
    } as any;
    const res = {
      path: vi.fn(() => res),
      render: vi.fn(),
      status: vi.fn(() => res),
    } as any;

    getContactPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('contact.html', {
      path: '/contact',
      messages: req.flash(),
    });
  });
});

describe('getVerifyEmailPage', () => {
  test('returns verify email page', async () => {
    const req = {
      flash: vi.fn(() => []),
      query: {
        token: 'token',
        email: 'email',
      },
    } as any;

    const res = {
      render: vi.fn(),
      status: vi.fn(() => res),
      redirect: vi.fn(),
    } as any;

    User.findOne.mockResolvedValueOnce({ id: 1 });

    await getVerifyEmailPage(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/register');
  });
});

describe('getResetAPIKeyPage', () => {
  test('returns reset api key page', async () => {
    const req = {
      flash: vi.fn(() => []),
    } as any;

    const res = {
      render: vi.fn(),
      status: vi.fn(() => res),
    } as any;

    getResetAPIKeyPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('reset-api-key.html', {
      path: '/reset-api-key',
      messages: req.flash(),
    });
  });
});
