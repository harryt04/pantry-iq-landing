# PantryIQ

Decision support for restaurant operators managing sales, purchasing, and
waste. See [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/) for the product
and technical corpus — [`docs/tech-stack.md`](docs/tech-stack.md) is
authoritative for every technology choice.

## Prerequisites

- **Node.js** current LTS (v22+)
- **pnpm** via Corepack — run `corepack enable` once, then `corepack use
  pnpm@9.15.4` (or let the `packageManager` field in `package.json` pin it
  automatically)
- **Docker** (for local Postgres)

## Install

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local` with real local values. `DATABASE_URL` should point
at the Postgres container started below; generate `BETTER_AUTH_SECRET`
with:

```bash
openssl rand -base64 32
```

## Run

```bash
docker compose up -d   # starts local Postgres on localhost:5433
pnpm dev                # starts the app on http://localhost:3000
```

Run the precompute worker in a second process for daily scheduling:

```bash
pnpm jobs:precompute
```

The worker schedules a daily UTC run and receives import and item-setting
invalidations in the same PostgreSQL transaction as their source change. Web
requests also initialize the queue when they enqueue an invalidation, so a
separate worker can be rolled out independently.

Confirm the app booted:

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

To create a deterministic local dataset with five weeks of sales history,
run `pnpm db:migrate` followed by `pnpm db:seed`. The seed is idempotent and
uses a clearly marked local-only owner UUID until authentication is added.

For a clean local migration cycle, use the guarded rollback command:

```bash
ALLOW_DB_ROLLBACK=1 pnpm db:rollback
pnpm db:migrate
```

Rollback only accepts a database hosted on localhost and drops the PantryIQ
tables plus Drizzle's applied-migrations record. It is destructive and is
not a production migration strategy; production recovery uses a database
backup and a forward migration.

## Test

```bash
pnpm test        # unit tests (Vitest)
pnpm test:integration  # real PostgreSQL harness (Docker or local test DB)
pnpm test:a11y   # browser accessibility gate (Playwright + axe)
pnpm test:charts # greyscale chart gate with attached screenshot
pnpm lint         # Prettier check
pnpm format:check # Prettier format check
pnpm typecheck    # tsc --noEmit
pnpm build        # production build
```

The shared fixtures in `tests/fixtures/pantry.ts` cover a messy CSV, a
partial-data location, and a deterministic full year of history. Integration
tests use Testcontainers to start PostgreSQL 16 and always remove the
container after the test. To run the migration round-trip against a
disposable local PostgreSQL database instead, set `TEST_DATABASE_URL`; it
must use a localhost host because the test resets that database. Engine code
is expected to maintain at least 90%
line coverage once `MET-01` lands; arithmetic edge cases should be tested
with the full-year and partial-data fixtures rather than wall-clock dates.

## Environment variables

All variables the app reads are listed in [`.env.example`](.env.example).
Summary:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes (local) | Used by `docker-compose.yml` to provision the local Postgres container |
| `BETTER_AUTH_SECRET` | yes | Session signing secret for Better Auth |
| `BETTER_AUTH_URL` | yes | Base URL Better Auth issues callbacks against |
| `CONNECTOR_CREDENTIAL_KEY` | yes in production | Encryption key for connector OAuth credentials; generate a separate secret from the auth key |
| `SQUARE_CLIENT_ID` / `SQUARE_CLIENT_SECRET` | when Square is enabled (`INT-03`) | Square OAuth application credentials; never expose the secret to the browser |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` / `SQUARE_WEBHOOK_URL` | when Square webhooks are enabled (`INT-03`) | Square signs the webhook URL plus raw body; keep both values aligned with the Developer Dashboard |
| `SQUARE_API_BASE_URL` | optional (`INT-03`) | Override with `https://connect.squareupsandbox.com` for Square Sandbox testing |
| `TOAST_CLIENT_ID` / `TOAST_CLIENT_SECRET` / `TOAST_RESTAURANT_EXTERNAL_ID` | when Toast is enabled (`INT-04`) | Toast machine-client credentials and the restaurant external ID; never expose credentials to the browser |
| `TOAST_WEBHOOK_SECRET` / `TOAST_WEBHOOK_URL` | when Toast webhooks are enabled (`INT-04`) | Toast signs the raw body plus its timestamp; keep the secret aligned with the Toast configuration |
| `TOAST_API_BASE_URL` | optional (`INT-04`) | Override with the Toast sandbox host for connector tests |
| `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET` | when QuickBooks is enabled (`INT-05`) | Intuit OAuth application credentials; never expose the secret to the browser |
| `QUICKBOOKS_VERIFIER_TOKEN` | when QuickBooks webhooks are enabled (`INT-05`) | Intuit HMAC-SHA256 webhook verifier token |
| `QUICKBOOKS_CURRENCY_CODE` / `QUICKBOOKS_TAX_MODE` | when QuickBooks is enabled (`INT-05`) | Location currency and explicit `include` or `exclude` tax policy; mismatches are rejected |
| `QUICKBOOKS_API_BASE_URL` / `QUICKBOOKS_OAUTH_BASE_URL` | optional (`INT-05`) | Override the API and OAuth hosts for sandbox testing |
| `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | yes (except local dev) | S3-compatible object storage for raw CSV uploads — see [Object storage](#object-storage-csv-uploads) |
| `S3_REGION` / `S3_FORCE_PATH_STYLE` | optional; `S3_FORCE_PATH_STYLE=1` required for MinIO | S3-compatible client settings; defaults to `auto` region and virtual-hosted style |
| `PANTRYIQ_E2E` / `PANTRYIQ_E2E_STORAGE_DIR` | yes (local dev) | Enables the disk-backed storage fallback instead of S3; see [Object storage](#object-storage-csv-uploads) |
| `RESEND_API_KEY` | later | Transactional email — auth flows only, never notifications |
| `ANTHROPIC_API_KEY` | later (`CHT-02`) | LLM narration via the Vercel AI SDK |

No secrets are committed. `.env.local` is gitignored.

## Object storage (CSV uploads)

Raw CSV uploads go through `src/server/storage/object-storage.ts`, which
speaks the S3 API only. Without `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` / `S3_BUCKET` (or the local fallback below), uploads
fail with `ObjectStorageConfigurationError`.

### Local (`pnpm dev`)

Use the disk-backed fallback instead of running a real S3 endpoint:

```bash
PANTRYIQ_E2E=1
```

Add that to `.env.local`. Uploaded files land under
`.tmp/pantryiq-e2e-storage` by default; set `PANTRYIQ_E2E_STORAGE_DIR` to
override the path. This mode is fine for solo local dev, but files are
unencrypted on disk and vanish when `.tmp` is cleared — don't use it for
beta or production.

### Beta and production (Coolify, self-hosted on Unraid via MinIO)

Coolify runs on a VM on the same LAN as an Unraid machine. Rather than a
cloud S3 provider, host [MinIO](https://min.io) (a self-hosted,
S3-compatible object store) on Unraid and point the app's existing `S3_*`
vars at it — no code changes needed, since `S3ObjectStorage` already talks
plain S3 API.

**1. Install MinIO on Unraid**

- From Unraid's Community Applications, install the `MinIO` template (or
  run `docker run -d -p 9000:9000 -p 9001:9001 -v
  /mnt/user/appdata/minio:/data minio/minio server /data --console-address
  ":9001"`).
- Point MinIO's data directory at an Unraid share, e.g.
  `/mnt/user/appdata/minio`, so uploaded files persist on the array.
- Confirm the API port (default `9000`) is reachable from the Coolify VM
  over the LAN.

**2. Create a bucket and access keys per environment**

- In the MinIO console (default `9001`), create one bucket per
  environment — e.g. `pantry-iq-beta` and `pantry-iq-prod`. Don't share a
  bucket between them.
- MinIO Community Edition's console has no "create access key" button —
  IAM/access-key management was pulled out of the free console and gated
  behind the paid AIStor console. Create keys with the `mc` CLI instead
  (verified against MinIO server `2025-09-07T16:13:09Z`; commands may
  differ slightly on other versions — run `mc admin accesskey create
  --help` if something below doesn't match):

  1. Install `mc` on your workstation (not the Unraid box — the
     `minio/minio` server image doesn't bundle the `mc` client, so
     `docker exec` into it likely won't have `mc` available). On macOS:
     `brew install minio/stable/mc` (skip if `command -v mc` already finds
     it). Other platforms:
     https://min.io/docs/minio/linux/reference/minio-mc.html. Every
     command below runs from your workstation; it only needs network
     access to the Unraid box's port `9000`.

  2. Register an alias pointing at the server, using the **root**
     username/password you set when you started the MinIO container (on
     Unraid, check the container's `MINIO_ROOT_USER` /
     `MINIO_ROOT_PASSWORD` env vars if unsure). Single-quote both values —
     generated MinIO passwords often contain `!`, `$`, or `` ` ``, which
     zsh/bash will otherwise try to interpret (`!` in particular triggers
     zsh history expansion and breaks the command):
     ```bash
     mc alias set pantry-iq-beta 'http://<unraid-lan-ip>:9000' '<root-user>' '<root-password>'
     ```
     The alias name is just a local label — use one per bucket/environment
     so it's clear which credentials you're using, or reuse one alias for
     everything since they all point at the same server. Confirm it
     authenticated before moving on:
     ```bash
     mc admin info pantry-iq-beta
     ```
     A signature-mismatch error here means the username/password don't
     match the server's actual root credentials — double check them and
     re-run `mc alias set` (it overwrites the existing entry).

  3. Write a policy scoped to one bucket, e.g. `pantry-iq-beta-policy.json`:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": ["s3:*"],
           "Resource": [
             "arn:aws:s3:::pantry-iq-beta",
             "arn:aws:s3:::pantry-iq-beta/*"
           ]
         }
       ]
     }
     ```

  4. Create the access key, passing the policy file directly:
     ```bash
     mc admin accesskey create pantry-iq-beta --policy pantry-iq-beta-policy.json
     ```
     This prints the Access Key and Secret Key once — copy both
     immediately and store them (Coolify env vars, password manager). They
     are never shown again; list key IDs later with `mc admin accesskey
     list pantry-iq-beta`, but not the secret. Omitting `--policy` falls
     back to the root user's full permissions, which works but isn't
     scoped to the one bucket.

  5. Repeat steps 3–4 for the second bucket (`pantry-iq-prod`), with its
     own policy file and its own access key — don't reuse the beta key in
     production or vice versa.

**3. Configure each Coolify app**

In each app's environment variables (beta and production are separate
Coolify apps, so this is set twice, once per bucket/key pair):

```
S3_ENDPOINT=http://<unraid-lan-ip>:9000
S3_ACCESS_KEY_ID=<minio-access-key>
S3_SECRET_ACCESS_KEY=<minio-secret-key>
S3_BUCKET=<pantry-iq-beta or pantry-iq-prod>
S3_FORCE_PATH_STYLE=1
```

`S3_FORCE_PATH_STYLE=1` is required — MinIO doesn't support
virtual-hosted-style bucket addressing. Leave `S3_REGION` unset (defaults
to `auto`) unless MinIO is configured with a specific region.

Since the VM reaches Unraid by LAN IP, `S3_ENDPOINT` needs updating in
Coolify if either machine's address changes.

**Troubleshooting: `An error was encountered in a non-retryable streaming
request`**

This is an `@aws-sdk/client-s3` failure, not a MinIO configuration
problem: the SDK's default flexible-checksum streaming (`aws-chunked`
trailers) isn't compatible with every self-hosted S3-compatible server.
The app's `S3Client` already sets `requestChecksumCalculation:
'WHEN_REQUIRED'` (`src/server/storage/object-storage.ts`) to avoid this —
if you still hit it after pulling that change, check:

- The MinIO server logs for the same request (timestamps line up with the
  failed upload).
- That the alias still authenticates: `mc admin info <your-alias>`.
- Upload/preview failures are logged via the app's structured logger
  (`pantryiq.csv.uploads` / `pantryiq.csv.previews`) with the real
  underlying error — check Coolify's log viewer for the failing app first.

## Stack

TypeScript (strict) · Next.js App Router · React · Tailwind v4 · shadcn/ui
on Radix · PostgreSQL · Drizzle ORM · pg-boss · Better Auth · Vercel AI SDK
· Prettier · Vitest + Testcontainers + Playwright · Docker on Coolify.

Full reasoning in [`docs/tech-stack.md`](docs/tech-stack.md).

## Repository conventions

Package manager is **pnpm**. Do not add a `package-lock.json` or
`yarn.lock`. One deployable, one database — see
[`docs/tech-stack.md`](docs/tech-stack.md) §1.

Work is tracked in [`docs/feature-backlog.md`](docs/feature-backlog.md).
Read its claim protocol before picking up a ticket.
