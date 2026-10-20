/**
 * Tests for Valibot Perimeter Validation.
 */

import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.11";
import { CurrencyConvertSchema, EmailVerifySchema, validateInput } from "../src/core/validation.ts";
import { GlastorError } from "../src/core/errors.ts";

Deno.test("Validation - accepts valid currency convert parameters", () => {
  const input = { from: "usd", to: "eur", amount: "150.5" };
  const validated = validateInput(CurrencyConvertSchema, input, "req-val-1");

  assertEquals(validated.from, "USD");
  assertEquals(validated.to, "EUR");
  assertEquals(validated.amount, "150.5");
});

Deno.test("Validation - rejects invalid currency length and non-numeric amount", () => {
  const invalid = { from: "US", to: "EUROPE", amount: "abc" };

  try {
    validateInput(CurrencyConvertSchema, invalid, "req-val-2");
    throw new Error("Should have thrown");
  } catch (err) {
    assertEquals(err instanceof GlastorError, true);
    const glastorErr = err as GlastorError;
    assertEquals(glastorErr.statusCode, 400);
    assertEquals(glastorErr.code, "GLASTOR_SCHEMA_VALIDATION_FAILED");
  }
});

Deno.test("Validation - validates email format strictly", () => {
  const valid = validateInput(EmailVerifySchema, { email: "core@glastor.org" }, "req-val-3");
  assertEquals(valid.email, "core@glastor.org");

  assertThrows(() => {
    validateInput(EmailVerifySchema, { email: "not-an-email" }, "req-val-4");
  }, GlastorError);
});
