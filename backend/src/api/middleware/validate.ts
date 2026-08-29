import { z, ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";

type ValidateTargets = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

/**
 * Reusable Zod validation middleware.
 *
 * Validates `req.body`, `req.query`, and/or `req.params` against provided
 * schemas. On success the parsed (and potentially transformed) data replaces
 * the corresponding request property so downstream handlers receive sanitised
 * values. On failure the middleware short-circuits with a 400 response
 * containing structured field errors.
 *
 * Supports two calling conventions:
 *
 * 1. Single schema (validates body only — backward compatible):
 *    router.post("/", validate(CreateTaskSchema), handler);
 *
 * 2. Object with target keys:
 *    router.get("/", validate({ query: TaskListSchema }), handler);
 *    router.get("/:id", validate({ params: IdParamSchema }), handler);
 */
export function validate(schemaOrTargets: ZodSchema | ValidateTargets) {
  const targets: ValidateTargets =
    schemaOrTargets instanceof z.ZodObject || schemaOrTargets instanceof z.ZodType
      ? { body: schemaOrTargets as ZodSchema }
      : (schemaOrTargets as ValidateTargets);

  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, Record<string, string[]>> = {};

    if (targets.body) {
      const result = targets.body.safeParse(req.body);
      if (!result.success) {
        errors.body = result.error.flatten().fieldErrors as Record<string, string[]>;
      } else {
        req.body = result.data;
      }
    }

    if (targets.query) {
      const result = targets.query.safeParse(req.query);
      if (!result.success) {
        errors.query = result.error.flatten().fieldErrors as Record<string, string[]>;
      } else {
        (req as any).query = result.data;
      }
    }

    if (targets.params) {
      const result = targets.params.safeParse(req.params);
      if (!result.success) {
        errors.params = result.error.flatten().fieldErrors as Record<string, string[]>;
      } else {
        req.params = result.data as any;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
      return;
    }

    next();
  };
}
