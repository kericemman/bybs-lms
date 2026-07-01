import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

export function validate(schema) {
  return function validateRequest(req, _res, next) {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query
      });

      req.body = parsed.body ?? req.body;
      req.params = parsed.params ?? req.params;
      req.query = parsed.query ?? req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ApiError(400, "Validation failed", error.flatten()));
        return;
      }

      next(error);
    }
  };
}
