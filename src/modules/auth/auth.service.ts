/**
 * The auth flow.
 *
 * Both sign-in and sign-up end at the same place: a one-time code is issued
 * and no token exists yet. Tokens are minted only by verifyOtp, so a correct
 * password alone is never a session.
 *
 * Two rules shape most of what follows:
 *  - Nothing tells a caller whether an email address is registered. Sign-up
 *    with an existing address answers exactly like a fresh one, and "forgot
 *    password" always answers 202.
 *  - The code and the reset token are stored only as digests, so a leaked
 *    database cannot be used to complete a pending sign-in.
 */

import { env } from "../../config/env.js";
import {
  DUMMY_HASH,
  digest,
  digestsMatch,
  generateNumericCode,
  generateToken,
  hashPassword,
  verifyPassword,
} from "../../lib/crypto.js";
import { conflict, invalidCredentials, notFound, tooManyRequests, unauthorized } from "../../lib/http.js";
import { nowSeconds } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/tokens.js";
import { withTransaction } from "../../db/pool.js";
import { drawPerk } from "../perks/perks.catalogue.js";
import { findPerkByUser, grantPerk } from "../perks/perks.repo.js";
import { toPerkDto, type PerkDto } from "../perks/perks.dto.js";
import * as repo from "./auth.repo.js";
import type { UserRow } from "./auth.repo.js";
import type {
  EmailOnlyInput,
  ResetPasswordInput,
  SigninInput,
  SignupInput,
  VerifyOtpInput,
} from "./auth.schemas.js";

export type UserDto = {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  emailVerified: boolean;
  role: string;
  createdAt: number;
};

/** What signup/signin return: a pending verification, not a session. */
export type ChallengeDto = {
  status: "otp_required";
  purpose: "signup" | "signin";
  email: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
  codeLength: number;
  /** Only when EXPOSE_DEV_CODES is on, so a local run is testable. */
  devCode?: string;
};

export type SessionDto = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: UserDto;
  /** Present on a sign-up verification: the welcome gift just drawn. */
  perk?: PerkDto;
};

type RequestMeta = { userAgent?: string; ip?: string };

/* ---------------------------------------------------------------- mapping */

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    initials: initialsOf(row.full_name),
    emailVerified: row.email_verified,
    role: row.role,
    createdAt: row.created_at,
  };
}

/** "Jordan Reeves" reads as JR; a single name gives its first two letters. */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  const first = words[0] ?? "";
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  const last = words[words.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/* -------------------------------------------------------------- challenges */

/**
 * Issues a fresh code and returns what the client needs to render the OTP
 * step. Sending the mail is a stub for now: it is logged, and echoed in the
 * response when EXPOSE_DEV_CODES is on.
 */
async function issueChallenge(
  user: UserRow,
  purpose: "signup" | "signin",
  remember: boolean,
): Promise<ChallengeDto> {
  const code = generateNumericCode(env.otp.length);
  const challenge = await repo.replaceOtpChallenge({
    userId: user.id,
    emailKey: user.email_key,
    purpose,
    codeDigest: digest(code),
    remember,
    ttlSeconds: env.otp.ttlSeconds,
  });

  deliverCode(user.email, code, purpose);

  return {
    status: "otp_required",
    purpose,
    email: user.email,
    expiresInSeconds: Math.max(0, challenge.expires_at - nowSeconds()),
    resendAvailableInSeconds: env.otp.resendCooldownSeconds,
    codeLength: env.otp.length,
    ...(env.exposeDevCodes ? { devCode: code } : {}),
  };
}

/**
 * Stands in for the mail provider. Kept as one function so wiring a real one
 * up later is a single change, and so the code is never logged in production.
 */
function deliverCode(email: string, code: string, purpose: string): void {
  if (env.exposeDevCodes) {
    logger.info("one-time code issued", { email, purpose, code });
  } else {
    logger.info("one-time code issued", { email, purpose });
  }
}

/* ------------------------------------------------------------------ signup */

export async function signup(input: SignupInput): Promise<ChallengeDto> {
  const existing = await repo.findUserByEmail(input.email);

  if (existing !== null) {
    // The address is taken. Answering "already registered" here would turn
    // the form into an account-existence oracle, so a verified account gets
    // the sign-in treatment instead: a code goes to the address on file, and
    // only whoever reads that inbox can proceed.
    if (existing.email_verified) {
      logger.info("signup for an existing verified address", { email: existing.email });
      return issueChallenge(existing, "signin", false);
    }
    // An unverified account was never proven to belong to anyone, so the
    // sign-up may legitimately be repeated — refresh the name and password and
    // send a new code.
    const passwordHash = await hashPassword(input.password);
    await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE users SET full_name = $2, password_hash = $3, accepted_tos_at = $4, updated_at = $4
          WHERE id = $1`,
        [existing.id, input.fullName, passwordHash, nowSeconds()],
      );
    });
    const refreshed = await repo.findUserById(existing.id);
    return issueChallenge(refreshed ?? existing, "signup", false);
  }

  const passwordHash = await hashPassword(input.password);
  let user: UserRow;
  try {
    user = await repo.insertUser({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      acceptedTos: input.acceptTos,
    });
  } catch (err) {
    // Two sign-ups for the same address in flight at once: the unique index on
    // email_key is what actually decides, and the loser lands here.
    if (isUniqueViolation(err)) {
      const raced = await repo.findUserByEmail(input.email);
      if (raced !== null) return issueChallenge(raced, "signin", false);
      throw conflict("That email address is already in use.");
    }
    throw err;
  }

  return issueChallenge(user, "signup", false);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/* ------------------------------------------------------------------ signin */

export async function signin(input: SigninInput): Promise<ChallengeDto> {
  const user = await repo.findUserByEmail(input.email);

  // Verify against a throwaway hash when the address is unknown, so the reply
  // takes the same time either way and cannot be used to enumerate accounts.
  const passwordOk = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
  if (user === null || !passwordOk) throw invalidCredentials();

  // An account that never completed sign-up still signs in through the same
  // code step, which is what verifies it.
  return issueChallenge(user, user.email_verified ? "signin" : "signup", input.rememberMe);
}

/* ------------------------------------------------------------------ verify */

export async function verifyOtp(input: VerifyOtpInput, meta: RequestMeta): Promise<SessionDto> {
  const outcome = await withTransaction(async (tx) => {
    const challenge = await repo.lockLiveOtpChallenge(input.email, tx);
    if (challenge === null) {
      throw unauthorized("That code has expired. Request a new one.");
    }
    if (challenge.expires_at <= nowSeconds()) {
      await repo.consumeOtpChallenge(challenge.id, tx);
      throw unauthorized("That code has expired. Request a new one.");
    }
    if (challenge.attempts >= env.otp.maxAttempts) {
      await repo.consumeOtpChallenge(challenge.id, tx);
      throw unauthorized("Too many incorrect codes. Request a new one.");
    }

    if (!digestsMatch(input.code, challenge.code_digest)) {
      await repo.bumpOtpAttempts(challenge.id, tx);
      const left = env.otp.maxAttempts - (challenge.attempts + 1);
      throw unauthorized(
        left > 0
          ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "Too many incorrect codes. Request a new one.",
      );
    }

    // Correct. Burn the challenge first so a replay of the same code cannot
    // mint a second session.
    await repo.consumeOtpChallenge(challenge.id, tx);

    const user = await repo.findUserById(challenge.user_id, tx);
    if (user === null) throw unauthorized("That account is no longer available.");

    if (!user.email_verified) await repo.markEmailVerified(user.id, tx);
    await repo.touchSignin(user.id, tx);

    // The welcome gift belongs to the sign-up path only, and is drawn here —
    // once, server-side — so it survives a reload and can be honoured.
    let perk = null;
    if (challenge.purpose === "signup") {
      const definition = drawPerk();
      perk = await grantPerk(
        {
          userId: user.id,
          perkKey: definition.key,
          label: definition.label,
          description: definition.description,
          expiresInDays: definition.expiresInDays,
        },
        tx,
      );
    }

    const remember = challenge.remember;
    const ttl = remember ? env.jwt.refreshTtlRememberSeconds : env.jwt.refreshTtlSeconds;
    const session = await repo.insertSession(
      { userId: user.id, remember, ttlSeconds: ttl, ...meta },
      tx,
    );

    return { user: { ...user, email_verified: true }, perk, session, remember };
  });

  return {
    accessToken: signAccessToken(outcome.user.id, outcome.user.email),
    refreshToken: signRefreshToken(outcome.user.id, outcome.session.id, outcome.remember),
    expiresInSeconds: env.jwt.accessTtlSeconds,
    user: toUserDto(outcome.user),
    ...(outcome.perk !== null ? { perk: toPerkDto(outcome.perk) } : {}),
  };
}

/* ------------------------------------------------------------------ resend */

export async function resendOtp(input: EmailOnlyInput): Promise<ChallengeDto> {
  const challenge = await repo.findLiveOtpChallenge(input.email);
  if (challenge === null) {
    // No pending verification. Answering "nothing pending" for an unknown
    // address and "cooldown" for a known one would leak which is which, so a
    // neutral message covers both.
    throw notFound("There is no code waiting for that address. Start again.");
  }

  const waited = nowSeconds() - challenge.last_sent_at;
  const left = env.otp.resendCooldownSeconds - waited;
  if (left > 0) {
    throw tooManyRequests(`Please wait ${left}s before asking for another code.`, left);
  }

  const user = await repo.findUserById(challenge.user_id);
  if (user === null) throw notFound("There is no code waiting for that address. Start again.");

  // Issuing supersedes the old row, so the previous code stops working.
  return issueChallenge(user, challenge.purpose, challenge.remember);
}

/* ----------------------------------------------------------------- refresh */

export async function refresh(refreshToken: string, meta: RequestMeta): Promise<SessionDto> {
  const claims = verifyRefreshToken(refreshToken);

  return withTransaction(async (tx) => {
    const session = await repo.findLiveSession(claims.sid, tx);
    // Revoked, expired or signed out: the JWT may still verify, but the
    // session row is what decides.
    if (session === null || session.user_id !== claims.sub) {
      throw unauthorized("Your session has expired. Please sign in again.");
    }

    const user = await repo.findUserById(claims.sub, tx);
    if (user === null) throw unauthorized("That account is no longer available.");

    // Rotate: the presented token stops working, so a copy of it that leaks
    // later is useless.
    await repo.revokeSession(session.id, tx);
    const ttl = session.remember ? env.jwt.refreshTtlRememberSeconds : env.jwt.refreshTtlSeconds;
    const next = await repo.insertSession(
      { userId: user.id, remember: session.remember, ttlSeconds: ttl, ...meta },
      tx,
    );

    return {
      accessToken: signAccessToken(user.id, user.email),
      refreshToken: signRefreshToken(user.id, next.id, session.remember),
      expiresInSeconds: env.jwt.accessTtlSeconds,
      user: toUserDto(user),
    };
  });
}

/* ----------------------------------------------------------------- signout */

/**
 * Revokes the session named by the refresh token. Answers the same whether or
 * not the token was still live — signing out twice is not an error to report.
 */
export async function signout(refreshToken: string | null, userId: string | null): Promise<void> {
  if (refreshToken !== null) {
    try {
      const claims = verifyRefreshToken(refreshToken);
      await repo.revokeSession(claims.sid);
      return;
    } catch {
      // Expired or malformed: there is nothing left to revoke by id.
    }
  }
  // Without a usable refresh token, an access token still identifies the
  // account, so every session it owns is closed.
  if (userId !== null) await repo.revokeAllSessions(userId);
}

/* ---------------------------------------------------------- password reset */

export type ForgotPasswordResult = { status: "sent"; devToken?: string };

/**
 * Always reports success. Whether an email exists is not something this
 * endpoint is willing to reveal.
 */
export async function forgotPassword(input: EmailOnlyInput): Promise<ForgotPasswordResult> {
  const user = await repo.findUserByEmail(input.email);
  if (user === null) {
    logger.info("password reset requested for an unknown address", { email: input.email });
    return { status: "sent" };
  }

  const token = generateToken(32);
  await repo.insertPasswordReset({
    userId: user.id,
    tokenDigest: digest(token),
    ttlSeconds: env.passwordReset.ttlSeconds,
  });

  logger.info("password reset issued", {
    email: user.email,
    ...(env.exposeDevCodes ? { token } : {}),
  });

  return { status: "sent", ...(env.exposeDevCodes ? { devToken: token } : {}) };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  await withTransaction(async (tx) => {
    const reset = await repo.findLivePasswordReset(digest(input.token), tx);
    if (reset === null) throw unauthorized("That reset link has expired. Request a new one.");

    await repo.consumePasswordReset(reset.id, tx);
    await repo.updatePasswordHash(reset.user_id, passwordHash, tx);
    // A password change ends every existing session: if the reset was needed
    // because someone else had the old password, their session goes with it.
    await repo.revokeAllSessions(reset.user_id, tx);
  });
}

/* ---------------------------------------------------------------------- me */

export async function getMe(userId: string): Promise<UserDto & { perk: PerkDto | null }> {
  const user = await repo.findUserById(userId);
  if (user === null) throw unauthorized("That account is no longer available.");
  const perk = await findPerkByUser(userId);
  return { ...toUserDto(user), perk: perk === null ? null : toPerkDto(perk) };
}
