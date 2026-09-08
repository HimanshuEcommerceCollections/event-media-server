/**
 * Request schemas for the auth endpoints.
 *
 * Messages are written to be shown to a user as-is: the sign-in form puts a
 * 422's per-field message straight under the input.
 */

import { z } from "zod";
import { env } from "../../config/env.js";

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  // Deliberately looser than a full RFC 5322 pattern: the code is what proves
  // the address exists, so the only job here is to reject obvious typos.
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That does not look like an email address.")
  .transform((v) => v.toLowerCase());

/**
 * 8 characters with a little variety. The form's own strength meter scores
 * length, upper case, a digit and a symbol, so the floor here matches its
 * first two bars rather than demanding a "Strong" score.
 */
const password = z
  .string({ error: "Choose a password." })
  .min(8, "Use at least 8 characters.")
  .max(200, "That password is too long.")
  .refine((v) => /[A-Za-z]/.test(v), "Include at least one letter.")
  .refine((v) => /[0-9]/.test(v) || /[^A-Za-z0-9]/.test(v), "Include a number or a symbol.");

export const signupSchema = z.object({
  fullName: z
    .string({ error: "Enter your name." })
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "That name is too long."),
  email,
  password,
  acceptTos: z.literal(true, { error: "Please accept the Terms to continue." }),
});

export const signinSchema = z.object({
  email,
  // Not `password` — an existing account may predate the current rule, and
  // answering "use a number or symbol" to a sign-in attempt would tell an
  // attacker their guess was rejected by shape rather than by value.
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password."),
  rememberMe: z.boolean().optional().default(false),
});

export const verifyOtpSchema = z.object({
  email,
  code: z
    .string({ error: "Enter the code we sent you." })
    .trim()
    .regex(new RegExp(`^[0-9]{${env.otp.length}}$`), `Enter the ${env.otp.length}-digit code.`),
});

export const emailOnlySchema = z.object({ email });

export const refreshSchema = z.object({
  refreshToken: z.string({ error: "A refresh token is required." }).min(1),
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: "That reset link is not valid." }).min(1, "That reset link is not valid."),
  password,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
