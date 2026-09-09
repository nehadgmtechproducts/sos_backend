import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../utils/errors.js';

export const validateBody =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        badRequest(
          'VALIDATION_ERROR',
          'Some fields are missing or invalid.',
          result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        ),
      );
    }
    req.body = result.data;
    next();
  };
