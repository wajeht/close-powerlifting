/* UnauthorizedError is a class that extends Error and has a constructor that takes a message
parameter. */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super();
    this.message = message;
  }
}
