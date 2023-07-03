import { StatusCodes } from 'http-status-codes';
import { describe, expect, test } from 'vitest';

import { APICallsExceeded, NotFoundError, UnauthorizedError } from './api.errors';

describe('api.errors', () => {
  test('UnauthorizedError', () => {
    const error = new UnauthorizedError('unauthorized');
    expect(error.message).toBe('unauthorized');
    expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  test('NotFoundError', () => {
    const error = new NotFoundError('not found');
    expect(error.message).toBe('not found');
    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  test('APICallsExceeded', () => {
    const error = new APICallsExceeded('too many requests');
    expect(error.message).toBe('too many requests');
    expect(error.statusCode).toBe(StatusCodes.TOO_MANY_REQUESTS);
  });
});
