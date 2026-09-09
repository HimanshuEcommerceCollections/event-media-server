# Events & Media API

TypeScript + Express + PostgreSQL. Serves the auth flow, the welcome perk, all
page content and the quote-request enquiry for the Next app in `../frontend`.

## Running it

From the repository root (one level up), with Docker:

```bash
docker compose up
```

That starts Postgres and the API on <http://localhost:4000>. On the first boot
the API waits for the database, applies the migrations and seeds the content
tables, then starts listening — so the first request never lands on a
half-ready database.

Source is bind-mounted and watched, so an edit under `src/` restarts the server
in a couple of seconds.

Without Docker, with a Postgres of your own:

```bash
cp .env.example .env      # every value is also the built-in default
npm install
npm run dev
```

| Script            | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `npm run dev`     | Watch mode via tsx                                              |
| `npm run build`   | Compile to `dist/`                                              |
| `npm start`       | Run the compiled output                                         |
| `npm run seed`    | Re-apply the content seed, overwriting what is there            |
| `npm run typecheck` | `tsc --noEmit`                                                |
| `npm run test:api`  | Runs the Postman collection in `postman/` against a live API   |

`npm run seed` forces a refresh; the boot-time seed only runs when the
`services` table is empty, so an edit made directly in the database is not
silently reverted on the next restart.

## Testing it

`postman/` holds a Postman collection covering every endpoint — 42 requests,
187 assertions — ordered so it runs top to bottom as a smoke test: the sign-up
requests capture the one-time code and the tokens, and everything after them
uses those.

```bash
npm run test:api      # via npx newman, no install needed
```

Or import `postman/events-media-api.postman_collection.json` and
`postman/local.postman_environment.json` into Postman and hit **Run**. See
`postman/README.md` for what the assertions actually pin down — and note that a
full run needs `RATE_LIMIT_DISABLED=true` on the API, because 40 calls in a
minute is more than the limiter allows.

## Shape of a response

Success is always `{ "data": … }`; failure is always
`{ "error": { "code", "message", "details"? } }`. `message` is written to be
shown to a user as-is. `details` carries either a list of field errors —
`[{ "field", "message" }]`, which the sign-in form paints onto its inputs — or
an object such as `{ "retryAfterSeconds": 29 }`.

## Endpoints

### Auth

| Method | Path                        | Notes                                                    |
| ------ | --------------------------- | -------------------------------------------------------- |
| POST   | `/api/v1/auth/signup`       | → a one-time-code challenge, not a session               |
| POST   | `/api/v1/auth/signin`       | → a one-time-code challenge, not a session               |
| POST   | `/api/v1/auth/otp/verify`   | → the session (and, on sign-up, the welcome perk)        |
| POST   | `/api/v1/auth/otp/resend`   | 429 with `retryAfterSeconds` while the cooldown is live  |
| POST   | `/api/v1/auth/password/forgot` | Always 202 — it will not say whether an email exists  |
| POST   | `/api/v1/auth/password/reset`  | Ends every session on that account                    |
| POST   | `/api/v1/auth/refresh`      | Rotates: the presented refresh token stops working       |
| POST   | `/api/v1/auth/signout`      | Revokes one session, or all of them from an access token |
| GET    | `/api/v1/auth/me`           | Bearer token                                             |
| GET    | `/api/v1/auth/session`      | Cheap "is this token still good?" check                  |

Two rules shape the flow:

- **A password alone is never a session.** Both `signup` and `signin` end at a
  one-time code; only `otp/verify` mints tokens.
- **Nothing reveals whether an address is registered.** Signing up with an
  address already on file answers exactly like signing in with it — a code goes
  to that inbox, and only whoever reads it can proceed. Sign-in verifies the
  password against a throwaway hash when the address is unknown, so the reply
  takes the same time either way.

With no mail provider wired up, `EXPOSE_DEV_CODES=true` (the development
default) echoes the code as `devCode` and the reset token as `devToken` so the
flow is testable locally. It is forced off when `NODE_ENV=production`.

### Perks

| Method | Path                          | Notes                                     |
| ------ | ----------------------------- | ----------------------------------------- |
| GET    | `/api/v1/perks/me`            | The gift on this account, or `null`       |
| POST   | `/api/v1/perks/me/reveal`     | Records that the scratch card was scratched |
| GET    | `/api/v1/perks/catalogue`     | What can come up (public; odds are not published) |

The gift is drawn server-side, once, when the sign-up code is verified — not in
the scratch-card component. Otherwise a reload would re-roll it and nothing
could be honoured against a booking.

### Content — all public

| Method | Path                              |
| ------ | --------------------------------- |
| GET    | `/api/v1/content/home`            |
| GET    | `/api/v1/content/services`        |
| GET    | `/api/v1/content/services/:slug`  |
| GET    | `/api/v1/content/reviews`         |
| GET    | `/api/v1/content/legal`           |
| GET    | `/api/v1/content/legal/:slug`     |
| GET    | `/api/v1/content/pages`           |
| GET    | `/api/v1/content/pages/:slug`     |
| GET    | `/api/v1/content/commercial`      |
| GET    | `/api/v1/content/bundles`         |
| GET    | `/api/v1/content/bundles/:slug`   |
| POST   | `/api/v1/content/reviews/pulse`   |

A service detail response carries the catalogue row, its `pricing` block and a
`blocks` map grouped by kind (`intro`, `faq`, `step`, `kit`, `polaroid`,
`frame`, `card`, `marquee`, `included`). Shapes differ per service — a rentals
item carries a quantity step, a photo pack carries a duration — so blocks are
stored as JSONB and `pricing.model` says which calculator to expect: `items`,
`performers`, `hourly` or `packs`.

Every content response also carries `navigation`, the header dropdown and
overlay menu links derived from the catalogue, so adding a service does not
mean editing seven pages.

`/api/v1/content/pages/:slug` serves the narrative pages — `how-it-works`,
`about`, `faq`, `commercial`, `pricing`, `build` — as `{ kind, payload }`
sections in document order, the same convention the legal documents use.

`/api/v1/content/commercial` is the B2B surface in one call: the page copy plus
every service flagged `is_b2b` with its pricing model attached.

### Pricing

| Method | Path                        | Notes                                        |
| ------ | --------------------------- | -------------------------------------------- |
| GET    | `/api/v1/pricing`           | The `pricing.v1` document `/pricing` renders  |
| GET    | `/api/v1/pricing/builder`   | Six configurators + the builder enums, one call |
| GET    | `/api/v1/pricing/:slug`     | One service model                            |

There is one set of prices. The service pages render it, `/pricing`
transcludes it and the builder prices against it — all from the `pricing`
block on each service row. A second copy of the numbers is the thing that goes
stale, so there is no second copy; `fromCents` on the pricing document is
computed from the model rather than authored.

`/api/v1/pricing/builder` also carries the three enums the builder needs, with
the large-event rule marked on them: `eventTypes` (wedding is `alwaysLarge`),
`headcountBands` (`100+` is `large`) and `budgetBands`.

### Event booking requests

The core flow. One request carries the event and up to six configured
services.

| Method | Path                             | Notes                                       |
| ------ | -------------------------------- | ------------------------------------------- |
| POST   | `/api/v1/bookings/quote`         | Prices a package, stores nothing            |
| POST   | `/api/v1/bookings`               | Open to visitors; a token is attached if sent |
| GET    | `/api/v1/bookings/mine`          | Bearer token                                |
| GET    | `/api/v1/bookings/:reference`    | The success page, reloadable                |

**No price is accepted from the client.** A line is `{ serviceType,
configuration }` and every figure is read from the catalogue here, so the
running total the page shows can be checked rather than trusted. Sending a
price field is a 422 — there is nowhere to put it.

`clientTotal` is optional and advisory: send what the page had on screen and a
disagreement is rejected with both numbers, so a stale total becomes a caught
error rather than a wrong quote in the inbox.

`largeEventFlag` is derived on the server from the event type and the headcount
band — a wedding, or 100+ guests — never accepted from the client, so the
coordinator caveat cannot be skipped by a page that forgot to send it.

References are `EVM-2026-0001`: sequential per year, minted from an atomic
counter rather than a random string. Vendor applications use `EVV-` on the
same counter.

### Vendor applications

| Method | Path                                     | Notes                          |
| ------ | ---------------------------------------- | ------------------------------ |
| GET    | `/api/v1/vendors/service-types`          | What can be applied for        |
| POST   | `/api/v1/vendors/applications`           | Open to visitors               |
| GET    | `/api/v1/vendors/applications/:reference`| The submitted application      |

Applying for `drone-video` requires Part-107 details, and they are **collected,
not validated** — nothing here checks a certificate against the FAA. The stored
record and the response both carry `verified: false`, and no surface may
present a submitted number as a certification. Part-107 details sent by an
applicant who is not applying to fly are dropped rather than stored.

### Analytics

| Method | Path                        | Notes                             |
| ------ | --------------------------- | --------------------------------- |
| POST   | `/api/v1/analytics/events`  | Batch of up to 20; answers 204     |

Stubbed by design: `build_add_service` and `build_total_view` are stored so the
funnel can be counted later, and nothing reads them yet. Only those two names
are accepted, so a page cannot turn this into a general-purpose log. A failed
write is swallowed rather than failing the beacon that carried it.

### Health

`/health` answers as long as the process is up. `/health/ready` also checks the
database and answers 503 if it is unreachable — that is the one Compose and a
load balancer should watch.

## No protected routes

`resolveAuth` runs on every request and never rejects: a missing or expired
token simply leaves the caller anonymous. No page is gated behind a sign-in and
there is no role check yet. The only endpoints that ask for an identity are the
ones that would have nothing to return without one — `/auth/me`,
`/perks/me`, `/requests/mine` — and a stale token in browser storage can never
make an otherwise public request fail.

## How it is put together

```
src/
  index.ts            boot order: secrets → wait for db → migrate → seed → listen
  app.ts              middleware and route mounting
  config/env.ts       every setting, with development defaults
  db/
    pool.ts           the pg pool and the query/transaction helpers
    migrate.ts        applies src/db/migrations/*.sql once each, under a lock
    seed.ts           idempotent content upserts
    seed-data/        the catalogue, copy and reviews as plain TS
  lib/                http envelope, crypto, tokens, ids, logger
  middleware/         auth, validation, rate limiting, error handling
  modules/
    auth/             routes → service → repo
    perks/
    content/          pages, services, reviews, legal, bundles
    pricing/          the catalogue, the engine, the published document
    bookings/         the core flow: one request, N configured services
    vendors/          Become a Vendor
    analytics/        the two stubbed builder events
```

Each module is a router, a service holding the decisions and a repo holding the
SQL, so a service reads as a sequence of decisions rather than a sequence of
queries and a column rename touches one file.

### Choices worth knowing

- **scrypt, not bcrypt** — `node:crypto` only, so there is no native module to
  build. Parameters are the OWASP minimum (N=2^16, r=8, p=1), which needs 64 MB
  per hash.
- **Codes and reset tokens are stored as SHA-256 digests.** A leaked database
  cannot be used to complete a pending sign-in.
- **Refresh tokens are backed by a `sessions` row.** A JWT alone cannot be
  revoked; the row is what makes sign-out and rotation-on-reuse work.
- **Timestamps are BIGINT unix seconds.** Every one of them is compared against
  a token expiry or a cooldown computed in seconds, so one unit end to end
  avoids converting on each read. Money is always integer cents.
- **The rate limiter is in-process.** Enough to blunt a password-guessing loop
  from one address; a shared store (Redis) is the replacement once more than
  one instance runs.
- **The client never sends a price.** The builder posts what was chosen and the
  engine prices it from the catalogue. This is what makes "a stale total is a
  defect" checkable: the total can be recomputed, so a disagreement is an error
  rather than a wrong quote nobody notices.
- **The pricing catalogue is cached in memory.** It changes when the seed runs,
  not per request, and pricing a six-service package would otherwise be six
  round trips on the one page the site is built around. `npm run seed`
  invalidates it.
- **Bundles store no total.** A package costs whatever its lines price to,
  computed on read through the same engine a hand-configured tile uses, so a
  bundle and the builder cannot disagree.
- **Part-107 details are collected, never validated.** Nothing checks a
  certificate against the FAA, so nothing may present one as a certification —
  the column comment, the response field and this line all say so on purpose.

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The overlay builds the compiled image, stops publishing Postgres to the host,
and has no defaults for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`POSTGRES_PASSWORD` or `CORS_ORIGINS` — a missing value fails at boot rather
than shipping a known signing key. The API refuses to start in production if
either JWT secret is still the development one.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
