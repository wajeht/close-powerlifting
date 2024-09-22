import { StatusCodes } from 'http-status-codes';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { ZodError } from 'zod';
import { ZodIssue, ZodIssueCode } from 'zod';

import { hostNameMiddleware, notFoundMiddleware, validationMiddleware } from './app.middlewares';
import { getHostName } from './utils/helpers';
import * as utils from './utils/helpers';
import redis from './utils/redis';

describe('notFoundHandler', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      url: '',
      originalUrl: '',
      query: {
        cache: false,
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      render: vi.fn(),
      json: vi.fn(),
    };

    next = vi.fn();
  });

  test('renders "not-found.html" if the URL does not start with "/api/"', () => {
    req.url = '/some-url';
    notFoundMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    expect(res.render).toHaveBeenCalledWith('not-found.html');
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('returns a JSON response if the URL starts with "/api/"', () => {
    req.url = '/api/some-url';
    req.originalUrl = '/api/some-url';
    notFoundMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith({
      status: 'fail',
      request_url: req.originalUrl,
      message: 'The resource does not exist!',
      cache: req.query.cache,
      data: [],
    });
    expect(res.render).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validate', () => {
  let req: any;
  let res: any;
  let next: any;
  let validators: any;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      flash: vi.fn(),
      originalUrl: '/test',
    };

    res = {
      status: vi.fn().mockReturnThis(),
      redirect: vi.fn(),
    };

    next = vi.fn();

    validators = {
      params: { parseAsync: vi.fn() },
      body: { parseAsync: vi.fn() },
      query: { parseAsync: vi.fn() },
    };
  });

  test('successfully validates and calls next if no errors', async () => {
    validators.body.parseAsync.mockResolvedValue({ foo: 'bar' });

    const middleware = validationMiddleware(validators);
    await middleware(req, res, next);

    expect(req.body).toEqual({ foo: 'bar' });
    expect(next).toHaveBeenCalled();
  });

  test('catches ZodError and flashes the error message, then redirects', async () => {
    const errorMessage = 'Zod validation error';

    // @ts-ignore
    const issue: ZodIssue = {
      code: ZodIssueCode.invalid_type,
      path: [],
      message: errorMessage,
    };

    const error = new ZodError([issue]);

    validators.body.parseAsync.mockRejectedValue(error);

    const middleware = validationMiddleware(validators);
    await middleware(req, res, next);

    expect(req.flash).toHaveBeenCalledWith('error', errorMessage);
    expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(res.redirect).toHaveBeenCalledWith(req.originalUrl);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next with error if non-ZodError occurs', async () => {
    const error = new Error('Something bad happened');
    validators.body.parseAsync.mockRejectedValue(error);

    const middleware = validationMiddleware(validators);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('handleHostname', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      app: {
        locals: {},
      },
      get: vi.fn(),
      protocol: 'http',
    };
    res = {};
    next = vi.fn();

    redis.get = vi.fn();
    redis.set = vi.fn();

    vi.spyOn(utils, 'getHostName').mockImplementation(vi.fn());
  });

  test('sets hostname from redis if available', async () => {
    const mockHostname = 'redis-hostname';

    (redis.get as Mock).mockResolvedValue(mockHostname);

    await hostNameMiddleware(req, res, next);

    expect(redis.get).toHaveBeenCalledWith('hostname');
    expect(req.app.locals.hostname).toBe(mockHostname);
    expect(next).toHaveBeenCalled();
  });

  test('sets hostname using getHostName if not available in redis', async () => {
    const mockHostname = 'new-hostname';

    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue(null);

    (utils.getHostName as Mock).mockReturnValue(mockHostname); // use the mocked getHostName

    req.get.mockReturnValue('localhost');

    await hostNameMiddleware(req, res, next);

    expect(redis.get).toHaveBeenCalledWith('hostname');
    expect(redis.set).toHaveBeenCalledWith('hostname', mockHostname);
    expect(getHostName).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalled();
  });
});
