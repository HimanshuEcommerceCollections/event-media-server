/**
 * POST /api/v1/auth/*
 *
 * The shapes here are the ones frontend/lib/api.js already calls, so they are
 * fixed by that contract: signup and signin both answer with a challenge, and
 * only otp/verify answers with a session.
 */

import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { badRequest, ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { bearerFrom } from "../../lib/tokens.js";
import * as service from "./auth.service.js";
import {
  emailOnlySchema,
  refreshSchema,
  resetPasswordSchema,
  signinSchema,
  signupSchema,
  verifyOtpSchema,
} from "./auth.schemas.js";
import type {
  EmailOnlyInput,
  RefreshInput,
  ResetPasswordInput,
  SigninInput,
  SignupInput,
  VerifyOtpInput,
} from "./auth.schemas.js";

export const authRouter = Router();

const metaOf = (req: { headers: Record<string, unknown>; ip?: string }) => ({
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  ip: req.ip,
});

/**
 * Password and code endpoints get a tighter budget than the rest of the API:
 * they are the ones worth guessing at. The write endpoints share one scope so
 * an attacker cannot get a fresh allowance by alternating between them.
 */
const credentialLimit = rateLimit({ scope: "auth-credentials", max: 12, windowSeconds: 60 });
const codeLimit = rateLimit({ scope: "auth-codes", max: 20, windowSeconds: 60 });

authRouter.post(
  "/signup",
  credentialLimit,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    ok(res, await service.signup(req.body as SignupInput), 201);
  }),
);

authRouter.post(
  "/signin",
  credentialLimit,
  validate(signinSchema),
  asyncHandler(async (req, res) => {
    ok(res, await service.signin(req.body as SigninInput));
  }),
);

authRouter.post(
  "/otp/verify",
  codeLimit,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    ok(res, await service.verifyOtp(req.body as VerifyOtpInput, metaOf(req)));
  }),
);

authRouter.post(
  "/otp/resend",
  codeLimit,
  validate(emailOnlySchema),
  asyncHandler(async (req, res) => {
    ok(res, await service.resendOtp(req.body as EmailOnlyInput));
  }),
);

authRouter.post(
  "/password/forgot",
  credentialLimit,
  validate(emailOnlySchema),
  asyncHandler(async (req, res) => {
    // 202: the address may not exist, and this endpoint will not say.
    ok(res, await service.forgotPassword(req.body as EmailOnlyInput), 202);
  }),
);

authRouter.post(
  "/password/reset",
  credentialLimit,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await service.resetPassword(req.body as ResetPasswordInput);
    ok(res, { status: "reset" });
  }),
);

authRouter.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    ok(res, await service.refresh((req.body as RefreshInput).refreshToken, metaOf(req)));
  }),
);

/**
 * Accepts either credential: the refresh token names one session to close,
 * and an access token alone closes all of them. Sending neither is the one
 * case that cannot do anything.
 */
authRouter.post(
  "/signout",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as { refreshToken?: unknown };
    const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : null;
    const userId = req.auth?.userId ?? null;
    if (refreshToken === null && userId === null) {
      throw badRequest("Send a refresh token or an access token to sign out.");
    }
    await service.signout(refreshToken, userId);
    ok(res, { status: "signed_out" });
  }),
);

// Needs an identity to have anything to answer with; see middleware/auth.ts.
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await service.getMe(req.auth!.userId));
  }),
);

/** Lets a client check a token without pulling the whole profile. */
authRouter.get("/session", (req, res) => {
  const hasToken = bearerFrom(req.headers.authorization) !== null;
  ok(res, {
    authenticated: req.auth !== undefined,
    ...(req.auth ? { userId: req.auth.userId, email: req.auth.email } : {}),
    // Distinguishes "signed out" from "token present but no longer valid", so
    // a client knows whether to try a refresh.
    tokenRejected: hasToken && req.auth === undefined,
  });
});
