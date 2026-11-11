// One error shape for every API response: { error: { code, message, details? } }.
// Throw an AppError subclass from any route; validate inputs with validate(); onError does the rest.
import type { Context, ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };

export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** details.fields maps a dotted path ("lines.0.qty") to its messages. */
export class ValidationError extends AppError {
  constructor(message: string, fields: Record<string, string[]>) {
    super(400, "VALIDATION", message, { fields });
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do this.") {
    super(403, "FORBIDDEN", message);
  }
}
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

const body = (code: string, message: string, details?: unknown): ErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

const HTTP_CODES: Partial<Record<number, string>> = { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 413: "TOO_LARGE" };

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof AppError) return c.json(body(err.code, err.message, err.details), err.status);
  // Hono's own errors, e.g. malformed JSON in validate("json", …).
  if (err instanceof HTTPException && err.status < 500) {
    return c.json(body(HTTP_CODES[err.status] ?? "BAD_REQUEST", err.message), err.status as ContentfulStatusCode);
  }
  console.error(`${c.req.method} ${c.req.path} failed:`, err);
  // Never send internals (stack, SQL, file paths) to a client in production.
  const dev = process.env.NODE_ENV !== "production";
  return c.json(body("INTERNAL", "Something went wrong. Please try again.", dev ? { cause: String(err) } : undefined), 500);
};

export const onNotFound = (c: Context) => c.json(body("NOT_FOUND", `No route for ${c.req.method} ${c.req.path}`), 404);

/** Zod issues → { "lines.0.qty": ["Too small: expected number to be >0"] }. "" is the whole input. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) (fields[issue.path.join(".")] ??= []).push(issue.message);
  return fields;
}

/**
 * Route middleware: parses c.req[target] with `schema`, or throws ValidationError (400).
 * Read the typed result with c.req.valid(target).
 */
/** What a client sends (the RPC client's types): the schema's input. Query, path and form values
 *  arrive as strings, so those keep the schema's keys (and which are optional) with string values. */
type Sent<T extends z.ZodType, Target> = Target extends "json" ? z.input<T> : { [K in keyof z.input<T>]: string | string[] };

export const validate = <T extends z.ZodType, Target extends "json" | "query" | "param" | "form">(target: Target, schema: T) =>
  validator(target, async (value) => {
    const result = await schema.safeParseAsync(value);
    if (!result.success) throw new ValidationError("Some fields are invalid.", fieldErrors(result.error));
    return result.data as z.output<T>;
  }) as MiddlewareHandler<any, string, { in: { [K in Target]: Sent<T, Target> }; out: { [K in Target]: z.output<T> } }>; // eslint-disable-line @typescript-eslint/no-explicit-any -- any Env, like Hono's own

/**
 * Runs a write and turns the named database constraints into field errors instead of a 500:
 * a unique violation → 409 CONFLICT, a missing reference (foreign key) → 400 VALIDATION.
 * `constraints` maps a constraint (or unique index) name to [field, message].
 */
export async function onConstraint<T>(constraints: Record<string, [field: string, message: string]>, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (e) {
    const pg = e as { errno?: string; constraint?: string };
    const hit = pg.constraint ? constraints[pg.constraint] : undefined;
    if (hit && pg.errno === "23505") throw new ConflictError(hit[1], { fields: { [hit[0]]: [hit[1]] } });
    if (hit && pg.errno === "23503") throw new ValidationError(hit[1], { [hit[0]]: [hit[1]] });
    throw e;
  }
}
