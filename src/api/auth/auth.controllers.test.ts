import { beforeEach, describe, expect, test, vi } from 'vitest';

// import { getGoogleOAuthURL } from '../../utils/helpers';
import { getGoogle, getGoogleRedirect } from './auth.controllers';

vi.mock('../../utils/helpers', () => ({
  getGoogleOAuthURL: vi.fn().mockReturnValue('mock-url'),
}));

// vi.mock('../api.errors.ts', () => ({
//   UnauthorizedError: vi.fn(),
// }));

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
