import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { ApiError } from '../utils/apiError.js';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        issues: error.issues
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  res.status(500).json({ error: { message } });
};

