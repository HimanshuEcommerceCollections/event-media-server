# API collection

`events-media-api.postman_collection.json` covers every endpoint the API
serves — 42 requests in nine folders, with 187 assertions.

It is ordered to run top to bottom: the sign-up requests capture the one-time
code and the tokens into collection variables, and everything after them uses
those. So the whole thing works as a smoke test, not just as a reference.

```
00 · Health                      liveness, readiness
01 · Auth — create an account    signup → verify → me → session → refresh → reuse
02 · Perks                       the welcome gift, revealed and re-read
03 · Content                     home, catalogue, service detail, reviews, legal, star tap
04 · Quote requests              submit, then list your own
05 · Auth — sign in again        signin → resend cooldown → verify
06 · Auth — sign out             signout, then a refresh that must fail
07 · Password reset              forgot → reset → new password works, old one does not
08 · Error cases                 eleven deliberate failures
```

## In Postman

1. Uncomment `RATE_LIMIT_DISABLED: "true"` in `docker-compose.yml` — see
   *Rate limits* below; a full run needs it.
2. Start the stack from the repository root: `docker compose up`.
3. **Import** both files in this directory — the collection and
   `local.postman_environment.json`.
4. Select the **Events & Media — local** environment.
5. Open the collection and hit **Run**.

Nothing else needs setting. `01 · Sign up` generates a fresh email address on
every run, so re-running never collides with the account it made last time.

## From the terminal

```bash
cd backend
npm run test:api
```

That is [Newman](https://github.com/postmanlabs/newman), Postman's CLI runner,
fetched on demand by `npx`. It is deliberately **not** a devDependency: it
pulls a large tree with a dozen advisories of its own, and none of it is needed
to run or ship the API.

Same caveat as above — relax the limiter first, or the run fails partway
through.

## Rate limits — read this before the first full run

A full run makes **40 calls** against `/api/*`. The API allows 30 a minute per
address, and the password endpoints allow 12 — so the last third of the run
fails with `too_many_requests` unless the limiter is relaxed first.

Turn it off for test runs. The line is already in `docker-compose.yml` under
`services.api.environment`, commented out:

```yaml
RATE_LIMIT_DISABLED: "true"
```

Then `docker compose up -d api`. The API logs a warning at startup while it is
off, and the switch cannot take effect when `NODE_ENV=production`.

Running a **single folder** needs none of this — the largest is 7 calls.

The collection logs a warning to the Postman console whenever a 429 arrives, so
this failure is easy to tell apart from a real one. One request *expects* a
429 — *05 · Resend the code too soon*, which pins down the OTP cooldown. That
cooldown is application logic rather than the limiter, so it keeps working with
the limiter off.

## Why the auth folders need a development API

There is no mail provider wired up, so `EXPOSE_DEV_CODES=true` — the
development default — echoes the one-time code back as `devCode` and the reset
token as `devToken`. That is what lets these requests chain.

It is forced off when `NODE_ENV=production`, so folders 01, 05 and 07 cannot
run end to end against a production API. Everything else can.

## What the tests actually check

Beyond status codes, the assertions pin down the decisions behind the API — so
a change that quietly breaks one of them fails the run:

- **A password alone is never a session.** `signup` and `signin` are asserted
  *not* to return an `accessToken`.
- **Nothing reveals whether an address is registered.** Signing in with an
  unknown address is compared byte for byte against the wrong-password
  response. `password/forgot` is asserted to answer 202 either way.
- **Rotation is real.** The refresh token that was just spent is replayed and
  must fail — the JWT still verifies, but its session row is revoked.
- **Token kinds are separate.** An access token spent as a refresh token must
  fail, even though both carry this service's signature.
- **The client does not decide prices.** A quote request posts no total, and
  the response's total is asserted against the arithmetic.
- **The reviews summary cannot drift from the wall.** The histogram buckets are
  asserted to add up to the row count.
- **The perk is server-side state.** It is drawn once at sign-up, absent from a
  sign-in verification, and its reveal is re-read on a second request.
- **Odds stay secret.** The perk catalogue is asserted *not* to expose
  `weight`.

## Editing it

Edit in Postman and export back over the file (**⋯ → Export → Collection
v2.1**). Keep the request order — the folders chain through collection
variables.

If you add an endpoint, add its request in the folder it belongs to and give it
a `description`: Postman renders those as the collection's API documentation,
which is the other half of what this directory is for.
