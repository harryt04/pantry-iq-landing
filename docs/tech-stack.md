# PantryIQ — Technology Stack

**Status:** Authoritative for technology choices. Approved by the founder
on 2026-08-07, which closes `FND-01` in
[`feature-backlog.md`](feature-backlog.md).

**Audience:** whoever writes the first line of application code, and
whoever later proposes changing one of these choices.

This document owns *what we build with and why*.
[`architecture-and-data-model.md`](architecture-and-data-model.md) owns
the schema and the recommendation engine's internals. Where a choice here
constrains that document, it says so.

---

## 1. The governing constraint

**One language, one deployable, one database.**

PantryIQ is self-funded, built by a very small team, and intended to be
profitable early. Every additional runtime, datastore, and service is a
tax paid every week forever: another thing to deploy, patch, monitor,
back up, and hold in your head at 11pm when the numbers look wrong.

The stack below is chosen to keep that count at one wherever it can be,
and to be honest about the two places it cannot.

Three further constraints shaped it:

1. **The trust contract.** Every figure must be reproducible and
   traceable to imported rows. That pushes arithmetic into typed,
   testable code over a relational database, and pushes it *out* of
   anything probabilistic.
2. **The full vision, not the MVP.** OAuth connectors, webhook receipt,
   incremental sync, recipe costing, labor forecasting, cross-location
   rollups, and eventually a second tenant type that must never read
   restaurant financials. See [`feature-backlog.md`](feature-backlog.md)
   §3.1.
3. **There will never be a native mobile app**
   ([`feature-backlog.md`](feature-backlog.md) §7). Responsive web is the
   entire client story, forever. That removes any argument for an
   API-first split, a BFF layer, or a shared mobile client contract.

## 2. The decisions

| Layer | Choice | One-line reason |
|---|---|---|
| Language | **TypeScript**, strict | The UI is already committed to React; a second language splits the type system |
| Runtime | **Node**, current LTS | Boring, well-understood, matches the framework |
| Framework | **Next.js**, App Router | Most screens render precomputed numbers — server components fit exactly |
| UI | **React + Tailwind v4 + shadcn/ui on Radix** | Already decided in `brand/ui-implementation.md` §1 |
| Database | **PostgreSQL** — and only PostgreSQL | It is the entire data layer: relational, JSONB, time-series-shaped, geospatial later |
| Data access | **Drizzle ORM** | Typed, but you still write real SQL. The engine needs SQL you can read |
| Jobs & scheduling | **pg-boss** | Precompute, imports, and connector sync on Postgres. No Redis |
| Auth | **Better Auth**, own the users table | Orgs, roles, and a second tenant type are coming |
| LLM access | **Vercel AI SDK** as the provider abstraction | Streaming and provider swap by configuration |
| LLM default | **Claude Haiku-class, with prompt caching** | Cheapest current-generation option that avoids a second cloud dependency |
| Object storage | **S3-compatible** (Cloudflare R2 or Tigris) | Raw CSVs kept for audit and replay, never on the app disk |
| Validation | **Zod**, at every boundary | Imported data is hostile by default |
| CSV parsing | **`csv-parse`**, streaming | A 200MB export must not become 2GB of heap |
| Numbers | **Postgres `numeric`; integer minor units in JS** | Money never touches a float |
| Time | **UTC in storage; an explicit business-day rule** | See §3.10 — this is a real domain trap |
| Testing | **Vitest + Testcontainers; Playwright** | Engine tests hit a real database, because mocks prove nothing about SQL |
| Lint & format | **Biome** | One tool, one config, fast |
| Errors & telemetry | **Sentry + OpenTelemetry traces** | A silently failing precompute run is the worst failure mode we have |
| CI | **GitHub Actions** | Where the code lives |
| Hosting | **Docker on a VPS via Coolify** | Already running it. One box until one box demonstrably fails |
| Transactional email | **Resend** (or equivalent) — **auth only** | See §3.14; this is not a notification channel |

---

## 3. The reasoning

Each subsection states the choice, what it beats, and **what it costs us
if it turns out wrong** — because that last part is the only honest way
to record a decision.

### 3.1 TypeScript, strict, everywhere

`brand/ui-implementation.md` §1 commits us to shadcn/ui on Radix
primitives with Tailwind. That fixes React, which fixes JavaScript in the
browser. Given that, running a second language on the server buys
capability at the cost of two type systems, two dependency trees, two
CI pipelines, and a serialization boundary between your metrics and your
UI that nobody type-checks.

The metrics engine is the product. Its outputs flow directly into
recommendation records, into chat context bundles, and onto the screen.
One end-to-end type system means a change to a metric's shape breaks the
build rather than breaking a number in front of an operator.

**Settings that matter:** `strict: true`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`. Turn these on at the empty project. Turning
them on later never happens.

**Rejected:** Python for the engine (see §4.1), Go for the backend
(fast, but splits the stack and buys us throughput we do not need).

**If wrong:** we discover TypeScript cannot express the statistical work
in `STF-03`. Mitigation is in §5.1 and is cheap — one worker behind a
queue, not a rewrite.

### 3.2 Next.js, App Router

The product is a set of screens that display numbers computed earlier.
That is the exact case server components are good at: query on the
server, render on the server, ship no client JavaScript for a table of
figures. Interactivity is concentrated in a few places — the chat
composer, the import wizard, the item master table — and those become
client components deliberately rather than by default.

One deployable serves the marketing site, the application, the connector
OAuth callbacks, and the webhook receivers. For a product with no mobile
client and no third-party API consumers, splitting those apart buys
nothing.

**Streaming matters here.** Chat responses stream token by token; Next.js
streams responses natively without a separate WebSocket layer to operate.

**Rejected:** Remix or React Router (excellent, smaller ecosystem for the
things we need); a SPA plus a separate API (two deployables, a hand-built
auth bridge, and no server rendering for the marketing site); Astro (the
app is too interactive).

**If wrong:** Next.js's opinions become an obstacle. The escape is real
but not free — the data layer, the engine, and the jobs are all
framework-independent by construction (§3.4, §3.5), so only the routing
and rendering layer would move.

### 3.3 PostgreSQL, and nothing else

This is the load-bearing decision of the whole document.

Everything the product needs, Postgres does well:

- **Relational analytics per item and per period** — the engine's entire
  job. Window functions, `generate_series` for gap-filling, lateral
  joins, `GROUPING SETS` for rollups. This is exactly what
  `MET-01`–`MET-07` are made of.
- **Exact numerics.** `numeric` is arbitrary-precision decimal. Money
  arithmetic is correct by default rather than correct if you remember.
- **JSONB** for raw imported rows, column mappings, and evidence traces —
  semi-structured data that must be kept verbatim for audit but is never
  joined on.
- **Full-text search** for item resolution's search box. No separate
  search service.
- **PostGIS**, if the donation marketplace ever returns and needs
  locality matching.
- **Transactional guarantees** that `ING-09` depends on: an import lands
  completely or not at all.
- **A job queue** (§3.5), so the queue and the data it operates on commit
  in the same transaction. This is a genuinely underrated property: a
  job that enqueues on commit cannot fire for a row that rolled back.

**Do not add a data warehouse.** A single restaurant location generates
on the order of tens of thousands of transaction rows per year. A hundred
locations is single-digit millions. Postgres on modest hardware handles
several orders of magnitude more than this product will see before it is
profitable. Reach for a warehouse when a query is slow *and* indexing,
partitioning, and precomputation have all failed — not before.

**Do not add Redis.** Its usual jobs here are caching, sessions, and
queueing. Postgres and the framework's own cache cover all three at our
scale, and Redis is a second stateful service to run, back up, and reason
about during a failover.

**Rejected:** MySQL (weaker analytics surface, no equivalent of PostGIS
or JSONB indexing depth); SQLite (fine until the first concurrent
precompute run); MongoDB (the data is relational — items, orders, lines,
counts — and pretending otherwise moves join logic into application code
where it cannot be tested against real data); ClickHouse or DuckDB
alongside Postgres (a second copy of the truth, and a sync problem).

**If wrong:** analytical queries stop meeting their budget. The
progression is: index, then materialize more aggressively in `MET-02`,
then partition by location and period, then consider a read replica. A
warehouse comes fourth, not first.

### 3.4 Drizzle ORM

The metrics engine is arithmetic expressed as SQL. Whoever maintains it
must be able to *read* what it does, and whoever reviews it must be able
to check the arithmetic against `docs/architecture-and-data-model.md`.

Drizzle gives typed schema definitions, typed results, and plain-SQL
migrations, while letting you drop to raw SQL for anything analytical
without leaving the type system. It is a thin layer, not a framework — no
lazy loading, no identity map, no query generation you have to reverse
engineer when a plan goes bad.

**The rule:** the engine writes explicit SQL. Application code uses the
query builder. Never express a window function through an abstraction
that hides it.

**Migrations** are generated but always reviewed by hand before commit,
and every migration must run forward and back on an empty database
(`FND-04`).

**Rejected:** Prisma (its own query engine, more magic between you and
the plan, historically awkward with raw analytical SQL); TypeORM
(decorator-heavy, unpredictable); raw `pg` with hand-written types (loses
the compile-time link between schema and result); Kysely (very good, and
a legitimate alternative — Drizzle wins narrowly on migration tooling).

**If wrong:** Drizzle is thin enough that leaving it means rewriting
query call sites, not rearchitecting. The schema and the SQL survive.

### 3.5 pg-boss for jobs and scheduling

Per D9 in the backlog, a scheduled deterministic pipeline computes every
number in the product. That needs a job runner with cron scheduling,
retries with backoff, concurrency limits, and singleton semantics so two
precompute runs for one location cannot overlap (`MET-02`, `INT-06`).

pg-boss provides all of it on top of Postgres. No new service, no new
backup, no new failure mode.

The property that actually matters: **jobs enqueue inside the same
transaction as the data change that triggered them.** When `ING-09`
commits an import, the recompute job commits with it. There is no window
where the import landed but the job was lost, and no window where the job
fires for data that rolled back. A separate broker cannot give you this
without an outbox pattern you would have to build and maintain.

**Rejected:** BullMQ (needs Redis); Temporal (superb, and enormous
operational weight for a product this size); cloud-native queues (vendor
coupling and a lost transactional boundary); cron on the host (no
retries, no visibility, no concurrency control, and invisible when it
fails).

**If wrong:** throughput exceeds what a Postgres-backed queue handles.
That is a good problem, arriving long after profitability, and the
job-handler interfaces are plain functions — the runner underneath is
replaceable.

### 3.6 Better Auth — and owning the users table

Authentication is where vendor lock hurts most, because identity is the
root of every ownership check in the system.

Two things are already known about the future:

1. Multi-user organisations with per-location roles — GM, chef, staff —
   are coming (D6). `MNU` and `STF` are the chef's and the manager's
   screens, not the owner's.
2. A second tenant type may arrive that must never read restaurant
   financial data.

Both are schema changes to identity. If the users table lives inside
someone else's service, both become integration projects. Better Auth
puts the tables in *our* database, alongside locations and transactions,
so an ownership check is a join rather than an API call — and
`QAG-06`'s isolation suite can test the real thing.

**Requirements regardless of library:** a current password-hashing
algorithm; revocable sessions; and one shared authorization helper that
every query passes through (`FND-05`). Ownership enforced at the query
layer, never in the UI.

**Rejected:** Auth0 or Clerk (fast to start, and identity data lives
elsewhere exactly when we need to reshape it; also priced per user, which
is the wrong shape for a per-location product); Supabase Auth (couples
identity to a platform we are not otherwise adopting, §4.4); rolling our
own password reset and session handling from scratch (no reason to).

**If wrong:** we own the tables, so migrating between libraries is a
password-hash format problem, which is tractable.

### 3.7 The LLM layer

**The abstraction:** the Vercel AI SDK. Provider-agnostic, streaming
first-class, and it keeps the model call at arm's length from the
application. `cost-and-pricing.md` makes clear that model pricing moves
constantly, so provider swap must be configuration, not a refactor.

**The default:** a Claude Haiku-class model with prompt caching enabled.
Reasoning, from `cost-and-pricing.md`:

- Gemini models are cheapest, but require a Google Cloud dependency the
  product deliberately avoided to keep the stack simple. That trade is
  not worth pennies per user per month.
- Claude Haiku 4.5 costs roughly $3.33/month for a power user, falling to
  about $1.98 with caching — comfortably inside the margin floor even at
  $20/location.
- Sonnet-class and above are loss-making at power-user volume and must be
  labelled "Premium — higher cost" if ever exposed.

**Prompt caching is not an optimisation here, it is part of the
architecture.** `MET-12` produces a byte-identical context bundle for
identical data precisely so the stable prefix caches. Roughly 80% of
input tokens are cacheable, cutting cost around 40%.

**The hard constraint, from D9:** the model receives precomputed results
and the `MET-12` bundle. It has no database access, no tools that
compute, and no write path. `CHT-03` verifies generated figures against
the supplied context *after* generation and blocks any response
containing a number that is not there. This is the single most important
guardrail in the product and it is enforcement, not prompt instruction.

**Re-verify pricing before launch.** The cost analysis is dated
2026-03-28 and explicitly calls itself a snapshot.

**Rejected:** LangChain (abstraction weight we do not need for one call
shape); calling provider SDKs directly (works, then you write the swap
layer yourself); model-generated SQL (§4.5).

### 3.8 Object storage for raw uploads

Uploaded CSVs are kept for audit and replay — `csv_upload_history`
records what was imported, and "show your work" cites the filename, row
count, and upload date. Those files must outlive any single application
container.

S3-compatible object storage, via Cloudflare R2 or Tigris. Both are
S3-API compatible, so the client library is standard and the provider is
swappable. R2 has no egress fees, which suits a workload that writes once
and reads rarely.

**Hard rules, from `QAG-04`:** storage keys are generated, never derived
from the user's filename. Type validation is on content, not extension.
A size ceiling is enforced server-side and stated in the UI before
upload.

**Rejected:** the application filesystem (lost on redeploy, unshareable
across containers, and a path-traversal surface); storing file bytes in
Postgres (bloats backups for data that is never queried).

### 3.9 Money, exactly

**Postgres `numeric` for every monetary and quantity column. Never
`float`, never `double precision`.** `FND-04` enforces this.

In TypeScript, JavaScript's `number` is a float, so the same trap exists
one layer up. Two acceptable patterns; pick one and apply it everywhere:

- Integer minor units (cents) for money, with conversion only at the
  presentation edge; or
- A decimal library at the arithmetic boundary.

The engine's own arithmetic should happen **in SQL wherever possible** —
Postgres does exact decimal natively, so a sum of `numeric` never drifts.
Pull values into JavaScript for shaping and presentation, not for
accumulation.

**Why this is not pedantic:** the trust contract requires that an
operator can recompute `$40` by hand from the evidence trace and get
`$40`. A figure that reads `$39.999999999999996` in a trace destroys more
trust than a missing figure does.

### 3.10 Time, and the restaurant business day

Every timestamp stores a timezone (`FND-04`). Storage is UTC; display is
in the location's local timezone, which means **`locations` needs a
timezone column** — worth adding in `FND-04` rather than discovering
during `MET-02`.

**The trap:** a restaurant's business day is not a calendar day. A drink
sold at 1:15am on Saturday belongs to Friday night's service, and every
operator in the world thinks about it that way. Bucketing by calendar
date splits one shift across two days and makes every day-part metric
subtly wrong — wrong in a way an operator will notice immediately and we
will not.

**The rule:** define a business-day boundary per location, default 4am
local, configurable. Every metric that buckets by day uses it. Implement
it once, in `MET-01`, as a single function every metric calls. Document
it in the evidence trace, because "Friday" needs to mean what the
operator means.

`STF-02` depends on this being right; sales and labor must align on the
same boundary or shift profitability is fiction.

**Library:** `date-fns` with explicit timezone handling, or the Temporal
API where the runtime supports it. Avoid Moment (deprecated). Never rely
on the server's local timezone for anything.

### 3.11 Validation at the boundary

Zod schemas at every point where data enters: form submissions, route
parameters, uploaded rows, connector API responses, webhook payloads, and
environment variables at startup.

Two of these deserve emphasis:

- **Imported CSV rows are hostile by default.** Not maliciously —
  operators export whatever their POS produces — but every assumption
  about a column's shape will eventually be wrong.
- **Connector responses are hostile too.** A vendor changing a field type
  in a minor API version should fail loudly at the boundary, not corrupt
  a spoilage figure three weeks later.

**Environment variables validate at startup**, so a misconfigured deploy
fails immediately rather than at the first query.

### 3.12 CSV parsing, streaming

`csv-parse` (from the `node-csv` family) in streaming mode. Reading an
entire upload into memory is how a single large export takes down the
process — a flagged risk area in the prior build's audit.

Requirements from `ING-03` and `QAG-04`: delimiter and encoding detection
including UTF-8 with BOM and Latin-1; quoted fields and embedded
newlines; header detection; per-row error collection rather than
whole-file rejection; and constant memory regardless of file size.

**On export** (`ING-11`), neutralise formula injection: any cell
beginning `=`, `+`, `-`, or `@` is prefixed so a spreadsheet cannot
execute it. This is a real attack path — imported item names flow
straight back out.

### 3.13 Testing

**Engine tests run against a real PostgreSQL instance, via
Testcontainers.** This is not optional. The metrics engine's correctness
lives in SQL — window functions, gap-filling, the business-day boundary.
A mocked query proves the mock works.

- **Vitest** for unit and integration tests. Metric functions get
  property tests: no metric may ever return a number when an input it
  depends on is absent (`MET-01`).
- **Testcontainers** spins up Postgres per suite, migrated and seeded.
- **Playwright** covers the critical path end to end: signup, create
  location, import, dashboard.
- **Shared fixtures** (`QAG-03`): a deliberately awful CSV set, a
  partial-data location, and a location with a full year of history.
- **Determinism:** no reliance on wall-clock `now`, no ordering
  assumptions. Inject the clock.

The worked salmon example from `mvp-scope-and-decisions.md` is a test.
Its figures must reproduce exactly.

### 3.14 Transactional email — and what it is not

Password reset and email verification need email. That is authentication
plumbing, and it is in scope.

**It is not a notification channel.** `feature-backlog.md` §7 puts
email, push, and webhook notifications permanently out of scope. Having
an email provider configured is exactly how that boundary gets eroded —
one "helpful" weekly digest at a time.

**The rule:** email may be sent only in response to a user action taken
seconds earlier, in an authentication flow. No digests, no alerts, no
recommendations, no re-engagement, no marketing. If a ticket proposes an
email that the user did not just trigger, it is out of scope.

`INT-08` exists because of this: stale-data failures must be unmissable
*in the app*, since nothing else will ever tell the operator.

**Provider:** Resend, or any equivalent. Low stakes, easily swapped.

### 3.15 Hosting and deployment

Docker containers on a VPS, orchestrated by **Coolify**, which is already
running. One application container, one Postgres, object storage
external.

This is deliberately unfashionable. It is also, for a self-funded product
with predictable load, the cheapest and most legible option available:
fixed monthly cost, no per-request billing surprises, no cold starts, and
long-running background jobs that just run — which serverless makes
awkward and pg-boss makes trivial here.

**Non-negotiables:**

- **Automated Postgres backups, with a tested restore.** An untested
  backup is not a backup. Restore into a scratch database on a schedule
  and confirm row counts.
- Migrations run as a deploy step, gated on success.
- Health checks, so a failed boot does not replace a working container.
- Secrets from the environment, never in the image.
- Object storage is off-box, so the VPS is replaceable.

**Rejected:** Vercel (excellent for the framework, awkward for
long-running scheduled work, and per-request pricing on a
precompute-heavy product); Kubernetes (operational weight vastly
exceeding the problem); serverless generally (the precompute pipeline is
the product, and it is the shape serverless suits least).

**If wrong:** the whole stack is containerised and framework-portable, so
moving to a managed platform later is a deployment change, not a rewrite.

### 3.16 CI and code quality

GitHub Actions, per `FND-03`: install, lint, type check, unit tests,
engine tests against real Postgres, and build. Failures block merge.

**Biome** for linting and formatting — one tool, one config file, fast
enough that nobody disables it.

Two gates are unusual and are the point of the product
(`QAG-01`, `QAG-02`):

- **Accessibility checks fail the build.** Contrast, focus rings,
  accessible names, touch target size, both themes.
- **The greyscale chart check fails the build.** Every chart is rendered,
  desaturated, and asserted still readable by pattern. A green colour
  value anywhere in chart code fails CI outright.

These exist because the product owner has red-green colour vision
deficiency, and because a colour-only chart shipped once and had to be
rejected. Automating them is what makes them real.

---

## 4. What we are deliberately not using

### 4.1 A Python service for the metrics engine

The obvious argument is pandas, NumPy, and the statistical ecosystem. The
counter-argument wins on this product:

The engine's work is overwhelmingly **relational aggregation**, not
numerical computing — sums, ratios, and window functions over items and
periods. Postgres does that better than pandas does, in-place, without
moving the data.

The cost of the split is permanent: two languages, two deploy pipelines,
a serialization boundary that nobody type-checks, and a metric shape
defined twice. For a team this size, that is a real tax paid weekly
against a benefit needed rarely.

**When to revisit:** §5.1.

### 4.2 A data warehouse or a second analytical store

At the volumes described in §3.3, a warehouse adds a second copy of the
truth and a synchronisation problem, in exchange for performance we do
not need. It also breaks the transactional guarantee that `ING-09`
depends on.

### 4.3 Redis

Caching, sessions, and queueing are all covered without it (§3.3, §3.5).
Adding it means a second stateful service to run, back up, and reason
about during failover, for no capability we currently lack.

### 4.4 Supabase, Firebase, or a backend platform

They are genuinely fast to start with. Two specific problems here:

- **Identity is the wrong thing to rent** (§3.6). Multi-user orgs and a
  second tenant type are both reshapes of the users table.
- **The engine is not CRUD.** It is scheduled, SQL-heavy, transactional
  work. Platform tooling is built for the opposite shape, and you end up
  running your own compute alongside anyway — at which point you have the
  platform's constraints *and* your own infrastructure.

### 4.5 Model-generated SQL, or any tool that lets the model compute

Considered and rejected as the grounding architecture. A wrong-but-
plausible generated query produces a confidently wrong number that is
indistinguishable from a right one — the precise failure the trust
contract exists to prevent, and the one that "loses the user for good."

D9 stands: the model narrates precomputed results and may observe
patterns in the interpretable data layer, labelled as observations. It
never calculates.

### 4.6 GraphQL, tRPC, or an API layer

There is no external consumer. There will never be a mobile client
(§1). There is no MCP server. Server components call server functions
directly. An API layer here is indirection with no client on the far side
of it.

### 4.7 A microservice split

One deployable, one team, one database. Split when an independently
scaling boundary genuinely exists — not before, and probably never.

---

## 5. Known weaknesses, and the triggers to revisit

Recorded honestly so the next decision is made on evidence rather than
memory of an argument.

### 5.1 Statistical forecasting in TypeScript

`STF-03` needs defensible demand forecasting. Seasonality decomposition
and error measurement are Python's home ground, and the TypeScript
ecosystem is thinner.

**Position:** implement forecasting in SQL and TypeScript first.
Day-of-week and seasonal-index methods are arithmetic, they are
explainable — which D9 *requires*, since an unexplainable forecast is
unusable here regardless of accuracy — and they cover most of the value.

**Trigger to revisit:** measured forecast error stays materially worse
than a method we can only implement in Python, on real customer data, for
more than one location.

**The move, if triggered:** add **one** narrow Python worker consuming
from pg-boss, taking a series in and returning a forecast out. No shared
database access, no shared models, no second web service. The
boundary stays a queue.

### 5.2 Single-box hosting

One VPS is a single point of failure. Accepted deliberately: the product
is decision support consulted daily, not a point-of-sale system that
stops service when it is down. An hour of downtime costs an apology.

**Trigger to revisit:** a paying customer's workflow depends on
availability we cannot promise, or the box outgrows vertical scaling.

**Mitigation now:** tested restores (§3.15). The realistic disaster is
data loss, not downtime, and that is what backups address.

### 5.3 Prompt caching depends on bundle stability

The cost model assumes roughly 80% of input tokens cache. That holds only
while `MET-12` produces byte-identical bundles for identical data. A
careless change — inserting a timestamp, reordering a map — silently
destroys the cache hit rate and roughly doubles inference cost with no
visible symptom.

**Mitigation:** `MET-12` asserts byte-identical output in a test, and
`QAG-05` logs the cache-hit rate so a regression is visible in a number
rather than in a bill.

### 5.4 Postgres as queue, cache, search, and store

Consolidation is the strategy, and its cost is concentrated blast radius:
a Postgres problem is an everything problem.

**Accepted**, because the alternative — four services to keep healthy —
is worse for a team this size. **Mitigation:** connection pooling
configured deliberately so job workers cannot starve web requests;
monitor connection counts and queue depth from day one (`QAG-05`).

---

## 6. How the stack serves the full vision

Traceability against [`feature-backlog.md`](feature-backlog.md) §3.1, so
no committed capability is discovered later to be unsupported.

| Capability | Served by | Notes |
|---|---|---|
| CSV and manual import | Streaming `csv-parse`, Zod, Postgres transactions | Atomic commit is a database guarantee, not application logic |
| Deterministic precompute (D9) | pg-boss cron + SQL + Drizzle | Enqueued transactionally with the import that triggers it |
| LLM narration, streaming | AI SDK + Next.js streaming | Prompt caching is architectural, not an optimisation |
| Square / Toast / QuickBooks | Next.js routes for OAuth and webhooks; pg-boss for sync and backfill | Resumable backfill is a durable-job problem, already solved |
| Incremental sync, reconciliation | pg-boss singleton jobs; `externalId` uniqueness | Singleton semantics prevent overlapping runs (`INT-06`) |
| Recipe and plate costing | Postgres relational modelling; `numeric` | Sub-recipes are recursive CTEs |
| Labor and forecasting | Postgres time-series aggregation; §5.1 escape hatch | Business-day boundary (§3.10) is load-bearing here |
| Weather and events | Standard HTTP clients; provenance stored as JSONB | Provider outage degrades the forecast, never breaks it |
| Cross-location aggregation | `GROUPING SETS` / rollup queries | Scope becomes a parameter (`AGG-01`), never a global |
| Multi-user orgs and roles, later | Our own users table (§3.6) | A schema migration, not a vendor integration |
| A second tenant type, if it returns | Same, plus query-layer isolation proven by `QAG-06` | The boundary is built now, whether or not it is used |

---

## 7. Decisions this document does not make

- **The price.** Unresolved in [`open-questions.md`](open-questions.md)
  §2 and unaffected by anything here.
- **Schema detail.** Owned by
  [`architecture-and-data-model.md`](architecture-and-data-model.md).
  Two additions this document implies, both belonging in `FND-04`: a
  timezone column on `locations`, and a business-day boundary setting.
- **Model choice as a permanent commitment.** Provider is configuration.
  Re-verify pricing before launch — the cost analysis is a snapshot.
- **Anything about donation.** Unscheduled; see `feature-backlog.md` §8.
  PostGIS is noted as available in §3.3 purely so nobody concludes the
  stack forecloses it.

## 8. Changing a decision here

If you believe one of these is wrong, you may well be right — several
were close calls. The process:

1. Say which decision, and which subsection of §3 or §4 argues for it.
2. Say what changed. New information, new requirement, or a measured
   failure — not a preference.
3. Say what it costs to switch now, and what it costs to switch in a
   year.
4. Get founder approval, then update this document *in place*, with the
   date and the reason. Do not create a second stack document.

The rule from [`../AGENTS.md`](../AGENTS.md) applies here as everywhere:
one file owns one category. This file owns technology choices.
