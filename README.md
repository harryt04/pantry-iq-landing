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
| `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | later (`ING-02`) | S3-compatible object storage for raw CSV uploads |
| `RESEND_API_KEY` | later | Transactional email — auth flows only, never notifications |
| `ANTHROPIC_API_KEY` | later (`CHT-02`) | LLM narration via the Vercel AI SDK |

No secrets are committed. `.env.local` is gitignored.

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
