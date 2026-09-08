/**
 * Every SQL statement the auth module runs.
 *
 * Keeping them here means the service reads as a sequence of decisions rather
 * than a sequence of queries, and a column rename touches one file. Each
 * function takes an optional Tx so it can join a caller's transaction.
 */

import { query, queryOne, execute, type Tx } from "../../db/pool.js";
import { newId, nowSeconds } from "../../lib/ids.js";

export type UserRow = {
  id: string;
  email: string;
  email_key: string;
  full_name: string;
  password_hash: string;
  email_verified: boolean;
  accepted_tos_at: number | null;
  role: string;
  created_at: number;
  updated_at: number;
  last_signin_at: number | null;
};

export type OtpRow = {
  id: string;
  user_id: string;
  email_key: string;
  purpose: "signup" | "signin";
  code_digest: string;
  attempts: number;
  remember: boolean;
  created_at: number;
  expires_at: number;
  last_sent_at: number;
  consumed_at: number | null;
};

export type SessionRow = {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
  remember: boolean;
};

export type ResetRow = {
  id: string;
  user_id: string;
  token_digest: string;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
};

/** A db-or-transaction handle, so each function works either way. */
type Runner = Pick<Tx, "query" | "queryOne" | "execute">;

const direct: Runner = { query, queryOne, execute };
const on = (tx?: Tx): Runner => tx ?? direct;

const USER_COLUMNS = `
  id, email, email_key, full_name, password_hash, email_verified,
  accepted_tos_at, role, created_at, updated_at, last_signin_at
`;

/* --------------------------------------------------------------------- users */

export const findUserByEmail = (emailKey: string, tx?: Tx): Promise<UserRow | null> =>
  on(tx).queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email_key = $1`, [emailKey]);

export const findUserById = (id: string, tx?: Tx): Promise<UserRow | null> =>
  on(tx).queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);

export async function insertUser(
  input: { email: string; fullName: string; passwordHash: string; acceptedTos: boolean },
  tx?: Tx,
): Promise<UserRow> {
  const now = nowSeconds();
  const row = await on(tx).queryOne<UserRow>(
    `INSERT INTO users
       (id, email, email_key, full_name, password_hash, accepted_tos_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING ${USER_COLUMNS}`,
    [
      newId("usr"),
      input.email,
      input.email.toLowerCase(),
      input.fullName,
      input.passwordHash,
      input.acceptedTos ? now : null,
      now,
    ],
  );
  if (row === null) throw new Error("insertUser returned no row");
  return row;
}

export const markEmailVerified = (userId: string, tx?: Tx): Promise<number> =>
  on(tx).execute(
    "UPDATE users SET email_verified = TRUE, updated_at = $2 WHERE id = $1",
    [userId, nowSeconds()],
  );

export const touchSignin = (userId: string, tx?: Tx): Promise<number> =>
  on(tx).execute("UPDATE users SET last_signin_at = $2 WHERE id = $1", [userId, nowSeconds()]);

export const updatePasswordHash = (userId: string, passwordHash: string, tx?: Tx): Promise<number> =>
  on(tx).execute(
    "UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1",
    [userId, passwordHash, nowSeconds()],
  );

/* ---------------------------------------------------------------- challenges */

/**
 * Supersedes any live challenge for the address before writing the new one, so
 * a resend or a second sign-in attempt leaves exactly one code valid. Without
 * this, an older code would keep working after a resend.
 */
export async function replaceOtpChallenge(
  input: {
    userId: string;
    emailKey: string;
    purpose: "signup" | "signin";
    codeDigest: string;
    remember: boolean;
    ttlSeconds: number;
  },
  tx?: Tx,
): Promise<OtpRow> {
  const runner = on(tx);
  const now = nowSeconds();
  await runner.execute(
    "UPDATE otp_challenges SET consumed_at = $2 WHERE email_key = $1 AND consumed_at IS NULL",
    [input.emailKey, now],
  );
  const row = await runner.queryOne<OtpRow>(
    `INSERT INTO otp_challenges
       (id, user_id, email_key, purpose, code_digest, remember, created_at, expires_at, last_sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7)
     RETURNING *`,
    [
      newId("otp"),
      input.userId,
      input.emailKey,
      input.purpose,
      input.codeDigest,
      input.remember,
      now,
      now + input.ttlSeconds,
    ],
  );
  if (row === null) throw new Error("replaceOtpChallenge returned no row");
  return row;
}

export const findLiveOtpChallenge = (emailKey: string, tx?: Tx): Promise<OtpRow | null> =>
  on(tx).queryOne<OtpRow>(
    `SELECT * FROM otp_challenges
      WHERE email_key = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [emailKey],
  );

/**
 * Locks the row for the duration of the caller's transaction. Two verify
 * requests arriving together would otherwise both read attempts = 4 and both
 * be allowed a guess.
 */
export const lockLiveOtpChallenge = (emailKey: string, tx: Tx): Promise<OtpRow | null> =>
  tx.queryOne<OtpRow>(
    `SELECT * FROM otp_challenges
      WHERE email_key = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE`,
    [emailKey],
  );

export const bumpOtpAttempts = (id: string, tx?: Tx): Promise<number> =>
  on(tx).execute("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1", [id]);

export const consumeOtpChallenge = (id: string, tx?: Tx): Promise<number> =>
  on(tx).execute("UPDATE otp_challenges SET consumed_at = $2 WHERE id = $1", [id, nowSeconds()]);

export const touchOtpSentAt = (id: string, tx?: Tx): Promise<number> =>
  on(tx).execute("UPDATE otp_challenges SET last_sent_at = $2 WHERE id = $1", [id, nowSeconds()]);

/* ------------------------------------------------------------------ sessions */

export async function insertSession(
  input: { userId: string; remember: boolean; ttlSeconds: number; userAgent?: string; ip?: string },
  tx?: Tx,
): Promise<SessionRow> {
  const now = nowSeconds();
  const row = await on(tx).queryOne<SessionRow>(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, remember, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, created_at, expires_at, revoked_at, remember`,
    [
      newId("ses"),
      input.userId,
      now,
      now + input.ttlSeconds,
      input.remember,
      input.userAgent ?? null,
      input.ip ?? null,
    ],
  );
  if (row === null) throw new Error("insertSession returned no row");
  return row;
}

export const findLiveSession = (id: string, tx?: Tx): Promise<SessionRow | null> =>
  on(tx).queryOne<SessionRow>(
    `SELECT id, user_id, created_at, expires_at, revoked_at, remember
       FROM sessions
      WHERE id = $1 AND revoked_at IS NULL AND expires_at > $2`,
    [id, nowSeconds()],
  );

export const revokeSession = (id: string, tx?: Tx): Promise<number> =>
  on(tx).execute("UPDATE sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL", [
    id,
    nowSeconds(),
  ]);

export const revokeAllSessions = (userId: string, tx?: Tx): Promise<number> =>
  on(tx).execute(
    "UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL",
    [userId, nowSeconds()],
  );

/* ------------------------------------------------------------ password reset */

export async function insertPasswordReset(
  input: { userId: string; tokenDigest: string; ttlSeconds: number },
  tx?: Tx,
): Promise<ResetRow> {
  const runner = on(tx);
  const now = nowSeconds();
  // Asking for a second link invalidates the first, so a forwarded old email
  // cannot be used later.
  await runner.execute(
    "UPDATE password_resets SET consumed_at = $2 WHERE user_id = $1 AND consumed_at IS NULL",
    [input.userId, now],
  );
  const row = await runner.queryOne<ResetRow>(
    `INSERT INTO password_resets (id, user_id, token_digest, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [newId("prt"), input.userId, input.tokenDigest, now, now + input.ttlSeconds],
  );
  if (row === null) throw new Error("insertPasswordReset returned no row");
  return row;
}

export const findLivePasswordReset = (tokenDigest: string, tx?: Tx): Promise<ResetRow | null> =>
  on(tx).queryOne<ResetRow>(
    `SELECT * FROM password_resets
      WHERE token_digest = $1 AND consumed_at IS NULL AND expires_at > $2`,
    [tokenDigest, nowSeconds()],
  );

export const consumePasswordReset = (id: string, tx?: Tx): Promise<number> =>
  on(tx).execute("UPDATE password_resets SET consumed_at = $2 WHERE id = $1", [id, nowSeconds()]);
