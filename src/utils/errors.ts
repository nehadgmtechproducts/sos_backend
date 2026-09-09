export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) =>
  new AppError(400, code, msg, details);
export const unauthorized = (code: string, msg: string) => new AppError(401, code, msg);
export const tooManyRequests = (code: string, msg: string) => new AppError(429, code, msg);
