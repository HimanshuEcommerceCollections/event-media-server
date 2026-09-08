/**
 * Environment configuration, read once at startup.
 *
 * Every value has a development default so `docker compose up` works with no
 * .env at all. The two JWT secrets are the exception in production: booting
 * with the built-in development secret would let anyone mint a valid token, so
 * NODE_ENV=production refuses to start without real ones.
 */

const DEV_SECRET = "dev-only-insecure-secret-change-me";

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be an integer, got "${raw}"`);
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

const nodeEnv = str("NODE_ENV", "development");
const isProd = nodeEnv === "production";

export const env = {
  nodeEnv,
  isProd,
  port: int("PORT", 4000),

  /** Origins allowed to call the API. */
  corsOrigins: str("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  db: {
    /**
     * A single URL keeps the container wiring to one variable. The individual
     * PG* parts are still honoured as a fallback so a local psql-style setup
     * needs no URL assembled by hand.
     */
    url: str(
      "DATABASE_URL",
      `postgres://${str("POSTGRES_USER", "eventsmedia")}:${str("POSTGRES_PASSWORD", "eventsmedia")}` +
        `@${str("POSTGRES_HOST", "localhost")}:${int("POSTGRES_PORT", 5432)}/${str("POSTGRES_DB", "eventsmedia")}`,
    ),
    ssl: bool("DATABASE_SSL", false),
    poolMax: int("DATABASE_POOL_MAX", 10),
    /** How long to keep retrying the first connection while Postgres boots. */
    connectRetrySeconds: int("DATABASE_CONNECT_RETRY_SECONDS", 30),
  },

  jwt: {
    accessSecret: str("JWT_ACCESS_SECRET", DEV_SECRET),
    refreshSecret: str("JWT_REFRESH_SECRET", `${DEV_SECRET}-refresh`),
    issuer: str("JWT_ISSUER", "events-media-api"),
    audience: str("JWT_AUDIENCE", "events-media-web"),
    /** Short-lived, because it is held in browser storage. */
    accessTtlSeconds: int("ACCESS_TTL_SECONDS", 60 * 15),
    refreshTtlSeconds: int("REFRESH_TTL_SECONDS", 60 * 60 * 24 * 7),
    /** "Remember me" extends only the refresh token. */
    refreshTtlRememberSeconds: int("REFRESH_TTL_REMEMBER_SECONDS", 60 * 60 * 24 * 30),
  },

  otp: {
    length: 6,
    ttlSeconds: int("OTP_TTL_SECONDS", 60 * 10),
    resendCooldownSeconds: int("OTP_RESEND_COOLDOWN_SECONDS", 30),
    maxAttempts: int("OTP_MAX_ATTEMPTS", 5),
  },

  passwordReset: {
    ttlSeconds: int("PASSWORD_RESET_TTL_SECONDS", 60 * 30),
  },

  /**
   * With no mail provider wired up, the one-time code and reset token are
   * echoed in the response so a local run is testable. Never in production.
   */
  exposeDevCodes: bool("EXPOSE_DEV_CODES", !isProd) && !isProd,

  /** Requests per window, per IP, on the auth endpoints. */
  rateLimit: {
    windowSeconds: int("RATE_LIMIT_WINDOW_SECONDS", 60),
    maxRequests: int("RATE_LIMIT_MAX", 30),
    /**
     * Turns the limiter into a pass-through. Only for running the API test
     * suite, which makes more calls in a minute than a real client ever
     * would; `&& !isProd` means a stray value in a production environment
     * cannot disable it.
     */
    disabled: bool("RATE_LIMIT_DISABLED", false) && !isProd,
  },

  /** Behind a reverse proxy, trust X-Forwarded-For for the client IP. */
  trustProxy: bool("TRUST_PROXY", false),
} as const;

export function assertProductionSecrets(): void {
  if (!env.isProd) return;
  const weak: string[] = [];
  if (env.jwt.accessSecret.includes(DEV_SECRET)) weak.push("JWT_ACCESS_SECRET");
  if (env.jwt.refreshSecret.includes(DEV_SECRET)) weak.push("JWT_REFRESH_SECRET");
  if (weak.length > 0) {
    throw new Error(
      `Refusing to start in production with development secrets: ${weak.join(", ")}. ` +
        "Set them to values of at least 32 random characters.",
    );
  }
}
