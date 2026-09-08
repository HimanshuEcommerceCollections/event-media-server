/**
 * Body/query validation via zod, translated into the 422 shape the sign-in
 * form paints onto its inputs: details: [{ field, message }].
 *
 * The parsed value replaces req.body, so a handler downstream works with the
 * coerced, trimmed, fully typed object rather than raw input.
 */

import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { badRequest, validationFailed, type FieldError } from "../lib/http.js";

type Source = "body" | "query" | "params";

export function validate<T>(schema: ZodType<T>, source: Source = "body"): RequestHandler {
  return (req, _res, next) => {
    const input = source === "body" ? req.body : source === "query" ? req.query : req.params;

    if (source === "body" && (input === undefined || input === null)) {
      next(badRequest("A JSON body is required."));
      return;
    }

    const result = schema.safeParse(input);
    if (!result.success) {
      const fields: FieldError[] = result.error.issues.map((issue) => ({
        // A top-level issue has an empty path; name it so the client still has
        // something to attach the message to.
        field: issue.path.length > 0 ? issue.path.join(".") : "_",
        message: issue.message,
      }));
      next(validationFailed(dedupeByField(fields)));
      return;
    }

    if (source === "body") req.body = result.data;
    else if (source === "params") req.validatedParams = result.data;
    else req.validatedQuery = result.data;

    next();
  };
}

/**
 * One field can raise several issues (too short *and* missing a digit). The
 * form shows one message per input, so only the first is kept.
 */
function dedupeByField(fields: FieldError[]): FieldError[] {
  const seen = new Set<string>();
  return fields.filter((f) => (seen.has(f.field) ? false : (seen.add(f.field), true)));
}
