// ============================================================
// Validation Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Type for Zod schema
type ZodSchema<T = unknown> = z.ZodType<T>;

// Interface for formatted error
interface FormattedError {
  field: string;
  message: string;
}

/**
 * Format Zod errors into a user-friendly response
 * Compatible with Zod v4 error structure
 */
function formatZodError(error: z.ZodError): FormattedError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
}

/**
 * Create validation error response
 */
function createValidationErrorResponse(errors: FormattedError[]) {
  return {
    error: 'Validation failed',
    details: errors,
  };
}

/**
 * Middleware factory for validating request body
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * app.post('/api/nodes', validateBody(CreateNodeSchema), createNode);
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json(createValidationErrorResponse(formatZodError(result.error)));
      return;
    }

    // Replace body with parsed/transformed data
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory for validating query parameters
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * app.get('/api/search', validateQuery(SearchQuerySchema), search);
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json(createValidationErrorResponse(formatZodError(result.error)));
      return;
    }

    // Replace query with parsed/transformed data
    req.query = result.data as Record<string, string | string[] | undefined>;
    next();
  };
}

/**
 * Middleware factory for validating URL parameters
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * app.get('/api/nodes/:id', validateParams(UuidParamSchema), getNode);
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json(createValidationErrorResponse(formatZodError(result.error)));
      return;
    }

    // Replace params with parsed/transformed data
    req.params = result.data as Record<string, string>;
    next();
  };
}

/**
 * Combined middleware for validating multiple request parts
 * @param options - Object containing schemas for body, query, and/or params
 * @returns Express middleware function
 *
 * @example
 * app.put('/api/nodes/:id', validate({
 *   params: UuidParamSchema,
 *   body: UpdateNodeSchema,
 * }), updateNode);
 */
export function validate(options: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: FormattedError[] = [];

    // Validate params
    if (options.params) {
      const result = options.params.safeParse(req.params);
      if (!result.success) {
        allErrors.push(
          ...formatZodError(result.error).map((e) => ({
            ...e,
            field: `params.${e.field}`,
          }))
        );
      } else {
        req.params = result.data as Record<string, string>;
      }
    }

    // Validate query
    if (options.query) {
      const result = options.query.safeParse(req.query);
      if (!result.success) {
        allErrors.push(
          ...formatZodError(result.error).map((e) => ({
            ...e,
            field: `query.${e.field}`,
          }))
        );
      } else {
        req.query = result.data as Record<string, string | string[] | undefined>;
      }
    }

    // Validate body
    if (options.body) {
      const result = options.body.safeParse(req.body);
      if (!result.success) {
        allErrors.push(
          ...formatZodError(result.error).map((e) => ({
            ...e,
            field: `body.${e.field}`,
          }))
        );
      } else {
        req.body = result.data;
      }
    }

    if (allErrors.length > 0) {
      res.status(400).json(createValidationErrorResponse(allErrors));
      return;
    }

    next();
  };
}
