/**
 * Password hashing and one-time secrets, on node:crypto only.
 *
 * scrypt is used rather than bcrypt so there is no native module to build and
 * no pure-JS bcrypt (which is slow enough that its work factor has to be
 * lowered to stay usable). Parameters follow the OWASP minimum: N=2^16, r=8,
 * p=1, which needs 64 MB of memory per hash, so maxmem is raised to match.
 */

import {
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const SCRYPT_N = 1 << 16;
const SCRYPT_R = 8;
// scrypt needs 128*N*r bytes for its scratch array (64 MB at these settings)
// plus working room on top, and OpenSSL rejects a maxmem that only just covers
// the array — hence the doubling rather than an exact figure.
const PARAMS = { N: SCRYPT_N, r: SCRYPT_R, p: 1, maxmem: 128 * SCRYPT_N * SCRYPT_R * 2 } as const;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Serialised as `scrypt$N$r$p$saltHex$keyHex` so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(password, salt, KEY_LEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltHex, keyHex] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * A hash to compare against when the email is not on file, so a sign-in
 * attempt for an unknown address costs the same time as one for a known
 * address and cannot be told apart by timing.
 */
export const DUMMY_HASH = `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${"00".repeat(SALT_LEN)}$${"00".repeat(KEY_LEN)}`;

/** A zero-padded decimal code, uniformly distributed over its whole range. */
export function generateNumericCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String(randomInt(0, 10));
  return out;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * One-time codes and reset tokens are stored as a SHA-256 digest, not in the
 * clear: a leaked database then cannot be used to complete a pending sign-in.
 * They are single-use and short-lived, so a plain digest is enough — no salt
 * or stretching is needed for a value with this much entropy.
 */
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function digestsMatch(candidate: string, storedDigest: string): boolean {
  const a = Buffer.from(digest(candidate), "hex");
  const b = Buffer.from(storedDigest, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
