export class UnauthorizedError extends Error {
  statusCode: number;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = 401;
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = 404;
  }
}

export class APICallsExceededError extends Error {
  statusCode: number;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = 429;
  }
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super();
    this.message = message;
    this.statusCode = 422;
  }
}
