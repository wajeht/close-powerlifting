import { StatusCodes } from 'http-status-codes';

export class UnauthorizedError extends Error {
  statusCode: StatusCodes;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = StatusCodes.UNAUTHORIZED;
  }
}

export class NotFoundError extends Error {
  statusCode: StatusCodes;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = StatusCodes.NOT_FOUND;
  }
}

export class APICallsExceeded extends Error {
  statusCode: StatusCodes;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = StatusCodes.TOO_MANY_REQUESTS;
  }
}
