import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../../utils/logger";
import { AppError } from "../../errors";

const log = createLogger();
const isProduction = process.env.NODE_ENV === "production";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      log.error(
        {
          error: err.message,
          code: err.code,
          stack: err.stack,
          method: req.method,
          path: req.path,
          requestId: res.locals.requestId,
        },
        "non-operational error",
      );
    } else {
      log.warn(
        {
          error: err.message,
          code: err.code,
          method: req.method,
          path: req.path,
          requestId: res.locals.requestId,
        },
        "operational error",
      );
    }

    const body: { error: { code: string; message: string; details?: unknown } } = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err.details !== undefined) {
      body.error.details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  log.error(
    {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      requestId: res.locals.requestId,
    },
    "unhandled error",
  );

  res.status(500).json({
    error: {
      message: isProduction ? "Internal server error" : err.message || "Internal server error",
      code: "INTERNAL_ERROR",
    },
  });
}
