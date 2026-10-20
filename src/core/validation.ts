/**
 * GLASTOR® Medusa - Zero-Trust Perimeter Validation Engine
 * Powered by Valibot (JSR) for ultra-lightweight, tree-shakeable schema enforcement.
 */

import * as v from "jsr:@valibot/valibot@^1.5.0";
import { GlastorError } from "./errors.ts";

// Currency Conversion Schema
export const CurrencyConvertSchema = v.object({
  from: v.pipe(
    v.string("Parameter 'from' must be a string"),
    v.trim(),
    v.toUpperCase(),
    v.length(3, "Currency code 'from' must be exactly 3 characters (e.g. USD, EUR)"),
  ),
  to: v.pipe(
    v.string("Parameter 'to' must be a string"),
    v.trim(),
    v.toUpperCase(),
    v.length(3, "Currency code 'to' must be exactly 3 characters (e.g. USD, EUR)"),
  ),
  amount: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\d+(\.\d+)?$/, "Amount must be a positive number"),
    ),
    "1",
  ),
});

export type CurrencyConvertInput = v.InferOutput<typeof CurrencyConvertSchema>;

// Currency Latest Schema
export const CurrencyLatestSchema = v.object({
  base: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.toUpperCase(),
      v.length(3, "Base currency must be 3 characters (e.g. USD)"),
    ),
    "USD",
  ),
  symbols: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.toUpperCase(),
    ),
    "",
  ),
});

export type CurrencyLatestInput = v.InferOutput<typeof CurrencyLatestSchema>;

// Email Verification Schema
export const EmailVerifySchema = v.object({
  email: v.pipe(
    v.string("Email address is required"),
    v.trim(),
    v.email("Invalid email format"),
  ),
});

export type EmailVerifyInput = v.InferOutput<typeof EmailVerifySchema>;

// IP Geolocation Schema
export const GeoIpLookupSchema = v.object({
  ip: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
    ),
  ),
});

export type GeoIpLookupInput = v.InferOutput<typeof GeoIpLookupSchema>;

/**
 * Validates untrusted input against a Valibot schema.
 * Throws a structured GlastorError (400 Bad Request) on schema mismatch.
 */
export function validateInput<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  data: unknown,
  requestId: string,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, data);

  if (!result.success) {
    const issues = result.issues.map((issue) => ({
      path: issue.path?.map((p) => p.key).join(".") || "root",
      message: issue.message,
    }));

    const summary = issues.map((i) => `[${i.path}] ${i.message}`).join("; ");

    throw new GlastorError({
      code: "GLASTOR_SCHEMA_VALIDATION_FAILED",
      statusCode: 400,
      message: "Input validation failed",
      reason: `Schema validation rejected parameters: ${summary}`,
      recovery:
        "Request was dropped at edge perimeter before reaching downstream or APILayer services.",
      remediation: "Review parameter names and formats against the /openapi.json specification.",
      requestId,
      details: issues,
    });
  }

  return result.output;
}
