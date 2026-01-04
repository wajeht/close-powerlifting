export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class APICallsExceededError extends AppError {
  constructor(message: string) {
    super(message, 429);
  }
}

export class ScraperError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public path: string,
  ) {
    super(message, statusCode);
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}
