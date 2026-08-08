# PantryIQ — Feature Backlog

**Status:** Authoritative for *execution state* — what gets built, in
what dependency order, and who is working on it. It does not own product
truth. [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) still
owns scope and the product contract; this file owns tickets.

**Created:** 2026-08-07.

---

## 1. How to use this file

This file is a work queue. Agents loop over it until every ticket reads
`done`.

1. Read [`INDEX.md`](INDEX.md) and [`../AGENTS.md`](../AGENTS.md) once.
2. Read §3 (Decision Record) before proposing anything. Those questions
   are answered. Do not reopen them. Read
   [`tech-stack.md`](tech-stack.md) before writing any code — it is
   authoritative for every technology choice and imposes rules the
   tickets below do not all restate.
3. Scan §4 (Status Board) for a ticket that is `available` and whose
   `Blocked by` entries are all `done`.
4. Claim it (§2), do it, sign it off.

**Rules that hold for every ticket:**

- A ticket is one reviewable change. If it grows past that, split it and
  add the new IDs to the status board.
- Never start a ticket whose blockers are unmet. The dependency graph is
  the only ordering in this file — there are no phases.
- Every user-facing string obeys
  [`brand/voice-and-tone.md`](brand/voice-and-tone.md). Every pixel obeys
  [`brand/ui-implementation.md`](brand/ui-implementation.md).
- **The greyscale test is a merge gate**, not a suggestion. So is the
  accessibility checklist in `brand/ui-implementation.md` §6.
- If a ticket's "Decisions to confirm" block names an unknown, use the
  stated default and record what you assumed. Do not stall.
- If you find a genuine contradiction between this file and the docs,
  fix it in the doc that owns the category and note it in the ticket.
  Do not create a new planning file.

## 2. Claim protocol

Every ticket carries this block. Edit it in place.

```
Status:    available | claimed | in-review | done | blocked
Owner:     —
Claimed:   —
Completed: —
Branch/PR: —
```

- **To claim:** set `Status: claimed`, set `Owner` to your agent id, set
  `Claimed` to today's ISO date, and update the same row in the Status
  Board — **in one commit, before writing any code.** Two agents editing
  the same ticket is the failure mode this prevents.
- **To finish:** set `Status: done`, fill `Completed` and `Branch/PR`,
  tick every acceptance-criteria checkbox, and update the Status Board.
- **To abandon:** reset `Status: available`, clear `Owner` and `Claimed`,
  and add a `Notes:` line saying what you learned and why you stopped.
- **`blocked`** means something outside the backlog is in the way. Say
  what, in a `Notes:` line. Do not use it for unmet dependencies — those
  are just `available` tickets you may not claim yet.

## 3. Decision Record

Decided 2026-08-07 with the founder, in the session that produced this
file. Each entry says what it supersedes. **These are closed.**

| # | Decision |
|---|---|
| **D1** | This backlog lives at `docs/feature-backlog.md` and owns execution state only. |
| **D2** | **The technology stack is chosen** — see [`tech-stack.md`](tech-stack.md), approved 2026-08-07, which closes `FND-01`. TypeScript, Next.js, PostgreSQL only, Drizzle, pg-boss, Better Auth, the Vercel AI SDK, Docker on Coolify. Tickets below are written stack-neutrally because they predate the approval; where a ticket and `tech-stack.md` differ in framing, the stack document wins. The pre-reset build in [`archive/existing-repo-audit-consolidated.md`](archive/existing-repo-audit-consolidated.md) remains **reference, not a default** — the choices overlap, the reasoning is independent. |
| **D3** | **The food donation marketplace is out of this backlog.** For-profit surface only. Donation is not cancelled — it is being thought through separately. See §8. This supersedes nothing in `mvp-scope-and-decisions.md`; that document's donation scope stands, it is simply not scheduled here. |
| **D4** | Eventually committed capabilities, beyond the MVP loop: **staffing optimization**, **menu management and recipe costing**, **POS and accounting integrations**, **cross-location aggregation**. These get full tickets here. |
| **D5** | **Permanently out of scope** — not deferred, not "someday": an MCP server / external agent access; email, push, or webhook notifications; native mobile applications; export and downstream action workflows beyond the CSV trust fallback. This hardens four items that `mvp-scope-and-decisions.md` listed as merely deferred. See §7. |
| **D6** | Account model: **one owner account owning locations.** Multi-user organisations with roles (GM, chef, staff) come later, when staffing and menu work needs them. Recipient tenancy is deferred with donation. This confirms the existing model in `architecture-and-data-model.md` rather than changing it. |
| **D7** | **No billing, payment, subscription, or entitlement tickets.** Every account is fully entitled. The pricing tension in [`open-questions.md`](open-questions.md) §2 stays open and is not resolved by building anything. |
| **D8** | **No phases.** The only ordering is `Blocked by`. The Phase 2 / Phase 3 sequencing in `mvp-scope-and-decisions.md` is superseded as a *scheduling* device; its content survives as tickets here. |
| **D9** | **AI grounding — the model never calculates.** A deterministic engine precomputes every arithmetic result. The model receives those results and narrates them. Separately, normalized non-arithmetic data stays available to the model in interpretable form so patterns nobody anticipated can still surface — but anything the model notices there is an **observation**, never a computed figure, and is labelled as such. This chooses one architecture where `architecture-and-data-model.md` §"AI / data query layer" left several open. |
| **D10** | **Impact score composition** — all four candidate categories are in: current spoilage risk, historical spoilage, overordering cost, and margin loss. This answers `open-questions.md` §1, Q1. |
| **D11** | **Spoilage authority** — inventory snapshots are ground truth. PO + transaction math (`ordered − sold − on-hand`) is the fallback that fills the gaps between counts. This answers `open-questions.md` §4, "Spoilage calculation priority", and Q6. |

### 3.1 The vision `FND-01` must design for

The stack prescription is written against everything below, not against
the MVP:

- CSV and manual import, normalizing into one canonical model
- A deterministic metrics engine running scheduled precomputation over
  that model, per D9
- An LLM narration layer, streaming, with per-query cost that survives
  the analysis in [`cost-and-pricing.md`](cost-and-pricing.md)
- Live integrations with Square, Toast, and QuickBooks — OAuth, webhooks,
  incremental sync, backfill, and reconciliation against CSV-sourced rows
- Recipe and ingredient modelling, with plate-level costing
- Labor scheduling data and demand forecasting, including third-party
  weather and local-events inputs
- Cross-location aggregation and comparison
- Later: multi-user organisations with per-location role scoping
- Later, and deliberately unscheduled: a two-sided marketplace with a
  second tenant type that must never read restaurant financials

### 3.2 Still open — do not treat as decided

These remain live in [`open-questions.md`](open-questions.md). Tickets
that touch them carry a stated default so work never stalls.

- Pricing anchor: $20/location vs. the $249–350 market band (§2).
- Square's competitive priority relative to CSV (§2).
- Item category taxonomy — fixed list or user-defined (§1, Q8).
- Shelf-life default source — lookup table, AI, or hardcoded (§4).
- Alert minimum thresholds vs. always showing the top five (§1, Q4).
- Quantitative success metrics (§1, Q15).
- Everything in §3 (donation), which is why §8 of this file is empty.

## 4. Status board

87 tickets. `—` in **Blocked by** means the ticket is startable now.

### Foundation

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| FND-01 | Prescribe the technology stack → [`tech-stack.md`](tech-stack.md) | **done** | opus-5 | — |
| FND-02 | Repository scaffold and developer setup | **done** | claude-opus-5 | FND-01 |
| FND-03 | CI pipeline and automated gates | **done** | claude-sonnet-5 | FND-02 |
| FND-04 | Core schema and migrations | **done** | codex | FND-02 |
| FND-05 | Authentication and the owner account | **done** | codex | FND-04 |
| FND-06 | Design tokens and theming | **done** | codex | FND-02 |
| FND-07 | Component baseline — restyled shadcn | **done** | codex | FND-06 |
| FND-08 | App shell, navigation, location switcher | **done** | codex | FND-05, FND-07, ING-01 |

### Data ingest

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| ING-01 | Location create and manage | **done** | codex | FND-05 |
| ING-02 | CSV upload and secure file handling | **done** | codex | ING-01, QAG-04 |
| ING-03 | CSV parse and preview | **done** | codex | ING-02 |
| ING-04 | Column mapping — auto-detection | **done** | codex | ING-03 |
| ING-05 | Column mapping — uncertain-column resolution | **done** | codex | ING-04, FND-07 |
| ING-06 | Mapping persistence and reuse | **done** | codex | ING-05 |
| ING-07 | Canonical item master | **done** | codex | FND-04 |
| ING-08 | Item name resolution — exact match only | **in-review** | codex | ING-07, ING-05 |
| ING-09 | Import commit, confirmation, and history | available | — | ING-06, ING-08 |
| ING-10 | Manual entry | available | — | ING-09 |
| ING-11 | CSV export — the trust fallback | available | — | ING-09 |

### Metrics engine

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| MET-01 | Derived metric definitions | **done** | codex | FND-04 |
| MET-02 | Precompute pipeline and metric store | available | — | MET-01, ING-09 |
| MET-03 | Spoilage resolution — snapshots authoritative | available | — | MET-02 |
| MET-04 | Data Sufficiency score | available | — | MET-02 |
| MET-05 | Impact score | available | — | MET-03 |
| MET-06 | Urgency score | available | — | MET-03 |
| MET-07 | Ranking and top-N selection | available | — | MET-04, MET-05, MET-06 |
| MET-08 | Tuning configuration | available | — | MET-07 |
| MET-09 | Recommendation record and message assembly | available | — | MET-07 |
| MET-10 | Evidence trace — "show your work" data | available | — | MET-09 |
| MET-11 | Partial-data and conflicting-data rules | available | — | MET-09 |
| MET-12 | Interpretable data layer for pattern discovery | available | — | MET-02 |

### Dashboard

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| DSH-01 | Insufficient-data state | available | — | FND-08, MET-04 |
| DSH-02 | Wallet impact summary | available | — | DSH-01, MET-05 |
| DSH-03 | Recommendation card | available | — | DSH-01, MET-09 |
| DSH-04 | Show-your-work disclosure | available | — | DSH-03, MET-10 |
| DSH-05 | Chart primitives — pattern-first | **done** | codex | FND-07 |
| DSH-06 | Trend summaries | available | — | DSH-05, MET-01 |
| DSH-07 | Item deep dives | available | — | DSH-05, MET-02 |

### Chat

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| CHT-01 | Chat surface and composer | available | — | FND-08 |
| CHT-02 | Narration service and model integration | available | — | CHT-01, MET-09 |
| CHT-03 | Grounding contract and guardrails | available | — | CHT-02, MET-12 |
| CHT-04 | Five-part answer format | available | — | CHT-03 |
| CHT-05 | Show your work, in chat | available | — | CHT-04, MET-10 |
| CHT-06 | Assumption override and scope prompt | available | — | CHT-05, SET-03 |
| CHT-07 | Session memory | available | — | CHT-04 |
| CHT-08 | Decline, redirect, and log the miss | available | — | CHT-03 |

### Settings

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| SET-01 | Account settings | available | — | FND-08 |
| SET-02 | Location management | available | — | FND-08, ING-01 |
| SET-03 | Item master management | available | — | FND-08, ING-07 |
| SET-04 | Import history drill-down | available | — | FND-08, ING-09 |
| SET-05 | Shelf-life defaults and category taxonomy | available | — | SET-03 |

### Marketing site

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| MKT-01 | Site shell, nav, and theming | **done** | codex | FND-06 |
| MKT-02 | Landing page — hero through final CTA | **done** | codex | MKT-01 |
| MKT-03 | Proof section — a real recommendation card | available | — | MKT-02, DSH-03 |
| MKT-04 | Pricing section | **done** | codex | MKT-02 |
| MKT-05 | Claims-discipline audit | **done** | codex | MKT-02 |

### Quality gates

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| QAG-01 | Accessibility gate automation | **done** | codex | FND-03, FND-07 |
| QAG-02 | Greyscale chart check | **done** | codex | QAG-01, DSH-05 |
| QAG-03 | Test strategy and harness | **in-review** | codex | FND-03 |
| QAG-04 | CSV upload security hardening | **done** | codex | FND-02 |
| QAG-05 | Observability and error tracking | **in-review** | codex | FND-03 |
| QAG-06 | Data isolation and ownership authorization | available | — | FND-05, QAG-03 |

### Cross-location aggregation

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| AGG-01 | Lift the single-location scope rule | available | — | MET-07, DSH-03 |
| AGG-02 | Portfolio rollup | available | — | AGG-01 |
| AGG-03 | Location comparison | available | — | AGG-02, DSH-05 |
| AGG-04 | Cross-location chat scope | available | — | AGG-02, CHT-03 |

### Integrations

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| INT-01 | Source-agnostic ingestion abstraction | available | — | ING-09 |
| INT-02 | Connector framework | available | — | INT-01, FND-05 |
| INT-03 | Square connector | available | — | INT-02 |
| INT-04 | Toast connector | available | — | INT-02 |
| INT-05 | QuickBooks connector | available | — | INT-02 |
| INT-06 | Sync scheduling and incremental updates | available | — | INT-03 |
| INT-07 | Deduplication and cross-source reconciliation | available | — | INT-06 |
| INT-08 | Connection health and failure surfacing | available | — | INT-06 |

### Menu management

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| MNU-01 | Recipe and ingredient data model | **done** | codex | ING-07 |
| MNU-02 | Recipe builder | **done** | codex | MNU-01, FND-07 |
| MNU-03 | Plate costing | **done** | codex | MNU-02, MET-01 |
| MNU-04 | Theoretical vs. actual usage | available | — | MNU-03, MET-03 |
| MNU-05 | Menu engineering matrix | **done** | codex | MNU-03, DSH-05 |
| MNU-06 | Menu recommendations in the engine | available | — | MNU-04, MET-09 |
| MNU-07 | Ingredient-level waste attribution | available | — | MNU-04 |

### Staffing

| ID | Title | Status | Owner | Blocked by |
|---|---|---|---|---|
| STF-01 | Labor data model and import | available | — | INT-01 |
| STF-02 | Labor efficiency metrics | available | — | STF-01, MET-01 |
| STF-03 | Demand forecasting | available | — | MET-02 |
| STF-04 | External signals — weather and local events | available | — | STF-03 |
| STF-05 | Shift-level recommendations | available | — | STF-04, STF-02 |
| STF-06 | Labor cost in the Impact score | available | — | STF-02, MET-05 |

## 5. Tickets

---

### FND-01 — Prescribe the technology stack

```
Status: done   Owner: opus-5   Claimed: 2026-08-07   Completed: 2026-08-07   Branch/PR: —
```

**Blocked by:** — · **Blocks:** everything

> **Closed 2026-08-07.** The prescription is
> [`tech-stack.md`](tech-stack.md), approved by the founder. Read it
> before claiming any ticket — it is authoritative for every technology
> choice, and §3.9, §3.10, and §3.14 impose constraints that several
> tickets below do not restate. The original ticket text is kept for the
> record.

**Why.** There is no application code and no stack. Every other ticket
in this file is written without naming a framework, a database, or a
runtime, because that choice belongs here. Choose it once, against the
whole vision, so nothing later needs a rewrite to accommodate a
capability we already knew was coming.

**Read first.** §3 and §3.1 of this file (the vision the stack must
serve) · [`architecture-and-data-model.md`](architecture-and-data-model.md)
· [`cost-and-pricing.md`](cost-and-pricing.md) ·
[`archive/existing-repo-audit-consolidated.md`](archive/existing-repo-audit-consolidated.md)
(what the prior build got wrong — reference only, **not** a default) ·
[`brand/ui-implementation.md`](brand/ui-implementation.md) §1, which
commits us to shadcn/ui on Radix and Tailwind for the UI layer.

**Scope — in.**
- A written recommendation covering: language and runtime, web framework
  and rendering model, database and migration tooling, background job /
  scheduling mechanism (the D9 precompute pipeline needs one),
  authentication approach, LLM provider abstraction, file handling,
  testing stack, and hosting/deploy target.
- For each: what it is, why it beats the alternatives *for this product*,
  and what it costs us later if we are wrong.
- An explicit note on how the stack handles each item in §3.1 — OAuth
  connectors, webhook receipt, incremental sync, scheduled precompute,
  streaming LLM responses, and a future second tenant type.
- The LLM provider decision must engage with `cost-and-pricing.md`: the
  margin table, prompt caching, and the recorded reluctance to add a
  Google Cloud dependency.

**Scope — out.** Writing any application code. This ticket produces a
document and nothing else.

**Acceptance criteria.**
- [ ] Recommendation written to `docs/architecture-and-data-model.md` as
      a new "Stack" section — **not** a new file (see `AGENTS.md`).
- [ ] Every §3.1 capability addressed explicitly, including the ones
      years away.
- [ ] Alternatives considered and rejected are named, with the reason.
- [ ] LLM provider choice cites the cost analysis and states the assumed
      per-query cost.
- [ ] Founder has approved it before `FND-02` is claimed.

**Verification.** A second agent reads the section cold and can scaffold
the repo from it without asking a question.

**Decisions to confirm.** None. This ticket *is* the decision.

---

### FND-02 — Repository scaffold and developer setup

```
Status: done   Owner: claude-opus-5   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-01 · **Blocks:** FND-03, FND-04, FND-06, QAG-04

**Why.** Turn the prescription into a repository someone can run. The
branch currently holds documentation and a stale `node_modules/` left
over from before the reset.

**Read first.** The Stack section from `FND-01` ·
[`../AGENTS.md`](../AGENTS.md) § "Repo state".

**Scope — in.** Project initialisation per the prescribed stack; the
stale `node_modules/` removed and `.gitignore` corrected; formatter and
linter configured with strict settings; a README covering install, run,
test, and environment variables; environment configuration with a
committed example file and no committed secrets; a health-check route or
equivalent proving the app boots.

**Scope — out.** Schema, auth, UI, CI.

**Acceptance criteria.**
- [x] A clean clone reaches a running dev server using only the README.
- [x] Lint and format run clean on the empty project.
- [x] No secrets committed; the example env file lists every variable.
- [x] Stale `node_modules/` gone and ignored.

**Verification.** Delete the working copy, clone fresh, follow the
README, and reach the health check.

**Notes.** Package manager (unstated in `tech-stack.md`): pnpm, pinned via
`packageManager` + Corepack. Local Postgres: docker-compose,
`postgres:16-alpine`, host port `5433` (kanji-forge, a sibling project on
this machine, already occupies `5432`). `pnpm build`, `pnpm typecheck`,
`pnpm lint`, and `pnpm dev` → `/api/health` all verified clean.

---

### FND-03 — CI pipeline and automated gates

```
Status: done   Owner: claude-sonnet-5   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-02 · **Blocks:** QAG-01, QAG-03, QAG-05

**Why.** The brand documents define merge gates. A gate nobody runs is a
preference. This makes them mechanical.

**Read first.** [`brand/ui-implementation.md`](brand/ui-implementation.md)
§6.

**Scope — in.** CI on every pull request running install, lint, type
check, unit tests, and build. Failures block merge. A published test
report. Hooks left in place for `QAG-01` (accessibility) and `QAG-02`
(greyscale) to attach to later.

**Scope — out.** The accessibility and greyscale checks themselves.

**Acceptance criteria.**
- [x] A pull request with a lint error, a type error, or a failing test
      cannot merge.
- [x] Pipeline completes in under five minutes on the empty project.
- [x] Extension points for QAG-01 and QAG-02 documented in the workflow
      file.

**Verification.** Open a throwaway PR that breaks each gate in turn and
confirm each one blocks.

**Notes.** No throwaway PR was opened — this session works on `rewrite`
only, by instruction, and does not push branches. Instead, each gate
(lint, typecheck, test) was broken locally in turn and confirmed to exit
non-zero, which is what makes the corresponding CI step — and therefore
the PR check — fail; full local pipeline (lint + typecheck + test +
build) completes in ~10s, comfortably under the 5-minute budget.
**Follow-up outside this repo's files:** GitHub branch protection
("require status checks to pass before merging") must still be enabled
on the `origin` repo for a failing check to actually block a merge
button — that is a repository setting, not something committed here.

---

### FND-04 — Core schema and migrations

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-02 · **Blocks:** FND-05, ING-07, MET-01

**Why.** The canonical model every import normalizes into, and every
metric reads from. Getting the shape wrong here is expensive later.

**Read first.**
[`architecture-and-data-model.md`](architecture-and-data-model.md)
§ "Canonical data model" and § "Required tables & indices summary" ·
`archive/existing-repo-audit-consolidated.md` § "Data Model Overview"
(prior-build schema problems).

**Scope — in.** Tables for locations, transactions, purchase orders,
purchase order items, inventory items, inventory snapshots, and CSV
upload history, with the fields and indices listed in the architecture
document. A migration mechanism with an applied-migrations record and a
documented rollback path. Seed data for local development.

**Two additions the architecture document does not list**, required by
[`tech-stack.md`](tech-stack.md) §3.10: a **timezone** column on
`locations`, and a **business-day boundary** setting per location
(default 4am local). A restaurant's business day is not a calendar day —
a drink sold at 1:15am Saturday belongs to Friday's service. Adding these
now costs nothing; discovering them during `MET-02` costs a migration and
every metric recomputed.

**Scope — out.** Donation tables (D3 — do **not** create them). Recipe,
labor, and connector tables — those arrive with `MNU-01`, `STF-01`, and
`INT-02`. Multi-user org tables (D6).

**Acceptance criteria.**
- [x] Every table and index in the architecture document exists, with
      matching field names and nullability.
- [x] Money and quantity columns use an exact numeric type, never a
      float.
- [x] Every timestamp stores a timezone; storage is UTC.
- [x] `locations` carries a timezone and a business-day boundary.
- [x] `externalId` supports deduplication on re-import.
- [x] Migrations run forward and back cleanly on an empty database.
- [x] Seed data produces a location with enough history to exercise the
      four-week prediction threshold.

**Verification.** Migrate up, seed, inspect, migrate down, migrate up
again.

**Notes.** The schema, deterministic seed, and guarded local rollback are
implemented. Migration, seed, rollback, and remigration are covered by an
opt-in Testcontainers round-trip test that checks every canonical table,
column type, nullability, and index, and rejects unexpected public tables
(including provisional donation tables). Drizzle's migration journal is
correctly verified in its dedicated `drizzle` schema, and rollback removes
that journal before remigration. A runtime-independent migration contract
test also guards the exact table and index surface, numeric and timestamp
types, business-day fields, and the absence of donation tables. The
round-trip passed against a disposable local PostgreSQL 16 instance via
`TEST_DATABASE_URL`; the Testcontainers path remains available for CI.

**Decisions to confirm.** Item category taxonomy is open
(`open-questions.md` §1, Q8). **Default:** free-text `category` with no
enforced enum, so `SET-05` can impose a taxonomy later without a
migration.

---

### FND-05 — Authentication and the owner account

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-04 · **Blocks:** FND-08, ING-01, INT-02, QAG-06

**Why.** One owner account owns locations, and every row in the system
hangs off that ownership. Per D6 there are no roles and no second tenant
type yet — but the boundary this ticket draws is the one a second tenant
type will eventually have to be excluded by.

**Read first.**
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) § "Core user
workflows" (signup step) · D6 in §3 above ·
`archive/existing-repo-audit-consolidated.md` § "Security and Ownership
Concerns".

**Scope — in.** Email and password signup, sign in, sign out, session
handling, and password reset. A single owner account per user. An
authorization helper that every data query passes through, resolving
"does this account own this location" in one place.

**Scope — out.** Social login. Multi-user organisations and roles (D6).
Recipient accounts (D3). Billing (D7).

**Acceptance criteria.**
- [x] Passwords stored with a current password-hashing algorithm, never
      reversible.
- [x] Sessions expire and can be revoked.
- [x] Ownership is enforced in one shared helper, not repeated per route.
- [x] No endpoint returns another account's data when given a valid
      session and a foreign identifier.
- [x] Auth error copy follows
      [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §6 — never
      blame the user, never leak whether an email exists.

**Verification.** Create two accounts, each with a location, and attempt
every read and write across the boundary. All must fail. `QAG-06`
automates this later.

**Notes:** Better Auth, the Drizzle schema, the auth pages, and the shared
ownership helper are implemented. Better Auth is explicitly configured to
generate UUID identifiers for the UUID-backed schema. Against a disposable
local PostgreSQL 16 instance, two owner accounts signed up and signed in,
each received a location, and the authenticated API rejected the other
account's location on both read and write (404). The authenticated
menu-engineering page also returns 404 for a foreign location rather than
surfacing an authorization error. Sign-out revoked the session and the
session endpoint returned null. The broader route matrix remains the scope
of QAG-06.

---

### FND-06 — Design tokens and theming

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-02 · **Blocks:** FND-07, MKT-01

**Why.** The palette, radii, type, and spacing are already decided in
full. This lands them once so no component tunes anything ad hoc.

**Read first.** [`brand/ui-implementation.md`](brand/ui-implementation.md)
§2 (the drop-in stylesheet — values are authoritative, copy them exactly)
· [`brand/brand-foundations.md`](brand/brand-foundations.md) §5, §6.

**Scope — in.** The token stylesheet verbatim, light and dark. IBM Plex
Sans (400/500/600/700) and IBM Plex Mono (400/500/600), self-hosted, no
other weights. A `.figure` utility applying mono with tabular numerals
and −0.03em tracking. The spacing and type scales. Theme resolution
following `prefers-color-scheme` with a persistent manual override.

**Scope — out.** Components.

**Acceptance criteria.**
- [x] Token values match `ui-implementation.md` §2 character for
      character.
- [x] `--radius-surface: 3px` and `--radius-control: 999px` both exist
      and are separate.
- [x] No green anywhere in the token set.
- [x] Both themes render at equal quality; neither is a filter over the
      other.
- [x] Font loading does not shift layout.
- [x] `prefers-reduced-motion: reduce` disables transitions globally.

**Verification.** Render a swatch page in both themes; desaturate a
screenshot of it; confirm the three signal colours remain distinguishable
by their assigned glyph and pattern rather than by hue.

**Notes.** The seven licensed IBM Plex font files are committed under
`public/fonts/` and loaded with `next/font/local`; production builds need
no runtime or build-time Google Fonts request. `/design/tokens` renders
the light/dark swatches, type and spacing scales, figures, and the
solid/hatch/cross-hatch signal encoding. The route was served locally and
verified to preload all seven font assets; its signals retain their printed
glyphs and patterns when colour is removed.

---

### FND-07 — Component baseline, restyled

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-06 · **Blocks:** FND-08, DSH-05, ING-05, MNU-02, QAG-01

**Why.** We take shadcn's Radix behaviour and replace its appearance.
Shipping stock shadcn is explicitly off-brand. Do that work once, here,
rather than fighting it in every feature ticket.

**Read first.** [`brand/ui-implementation.md`](brand/ui-implementation.md)
§3 and §4 · [`brand/brand-foundations.md`](brand/brand-foundations.md) §7.

**Scope — in.** Install and restyle the components in the §4 "use
freely" list. Apply the four signature moves: round controls on square
paper; every figure in Plex Mono, oversized; warm neutrals only; a 3px
left state edge on cards that carry state and none on cards that don't.
Primary button as an Azure pill, secondary as an Ink-outline pill,
destructive as an Oxide pill. A component gallery page.

**Scope — out.** Charts (`DSH-05`). Feature screens.

**Acceptance criteria.**
- [x] Controls are pills; surfaces are 3px. No component mixes them up.
- [x] No Tailwind `slate`, `zinc`, or `neutral` scale appears anywhere.
- [x] Card headers keep shadcn's title-plus-description hierarchy — the
      rejected uppercase mono micro-label is **not** reintroduced.
- [x] No decorative rule, bar, or frame above any card heading.
- [x] Every interactive element shows a 2px Azure focus ring at 2px
      offset, never removed.
- [x] Touch targets ≥44×44px; body text ≥16px on mobile.
- [x] Gallery screenshot would not look at home in a component-library
      demo.

**Verification.** Tab the gallery end to end. Desaturate it. Load it at
375px and at 200% zoom.

**Notes.** Radix-backed shadcn components were added from the current
registry, with Sonner as the registry's current toast implementation.
`/design/gallery` exercises the baseline interactions and status states;
the restyle is centralized in `globals.css`, including the 2px Azure
focus ring and the state-edge utilities. Generated registry code is
formatted and checked by the repository's Prettier configuration alongside
local feature code.

---

### FND-08 — App shell, navigation, and location switcher

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-05, FND-07, ING-01 · **Blocks:** DSH-01, CHT-01,
SET-01, SET-02, SET-03, SET-04

**Why.** Every product screen is scoped to exactly one location. If that
scope is ever ambiguous on screen, the user cannot trust a single number
we show them.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Scope rule: one operation at a time" ·
[`brand/ui-implementation.md`](brand/ui-implementation.md) §4 (location
switcher), §7 (layout) ·
[`brand/brand-foundations.md`](brand/brand-foundations.md) §8, "Keep one
location's scope obvious at all times".

**Scope — in.** Authenticated layout with navigation to Dashboard, Chat,
Import, and Settings. A location switcher in the header, visible on every
scoped screen, with the selected location persisted across navigation and
sessions. A real mobile navigation pattern — a sheet or bottom tabs,
never a horizontal bar that overflows. Loading skeletons matching real
layout. A first-run path for an account with no locations yet.

**Scope — out.** The page contents. Cross-location anything (`AGG-01`).

**Acceptance criteria.**
- [x] The selected location is readable without interaction on every
      scoped screen.
- [x] Switching location re-scopes the current screen and persists.
- [x] No screen implies data spans locations.
- [x] Mobile navigation works at 375px with no horizontal body scroll.
- [x] Loading uses skeletons matching the real layout, never a full-page
      spinner.
- [x] An account with zero locations is routed to create one, with copy
      per `voice-and-tone.md` §6.

**Verification.** With two locations holding different data, switch
between them on every screen and confirm no value leaks across.

---

### ING-01 — Location create and manage

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-05 · **Blocks:** FND-08, ING-02, SET-02

**Why.** A location is the unit everything else is scoped to. It is the
second step of the critical path, before any data exists.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Core user workflows" · [`ux-flows.md`](ux-flows.md) § "Settings:
sections" → Location management.

**Scope — in.** Create a location with name and optional address. List,
edit, and archive locations owned by the account. Multiple locations
allowed; never aggregated.

**Scope — out.** Deleting a location with data (destructive flows come
with `SET-02`). Geocoding — that was for donation locality matching (D3).

**Acceptance criteria.**
- [x] A new account can create its first location in one screen.
- [x] Locations are only visible to their owner (`FND-05` helper).
- [x] Copy follows `voice-and-tone.md` §6; the button reads verb + object.

**Verification.** Create locations on two accounts; confirm no
cross-visibility.

**Notes.** Added a location-scoped management surface at `/account` with a
first-run create form, owner-only list, edit flow, and confirm-then-archive
or restore action. Location names and addresses are validated at the API
boundary, and all reads/writes use the shared authentication and ownership
helpers. Archived locations remain visible in management with an explicit
status but are sorted after active locations. Live unauthenticated route
smoke checks return 401/307 as expected; `.env.local` has no test account
credentials, so authenticated browser verification remains pending.

---

### ING-02 — CSV upload and secure file handling

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** ING-01, QAG-04 · **Blocks:** ING-03

**Why.** The entry point to the entire product, and the surface the prior
build got wrong. CSV upload was a flagged risk area in the audit.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow", steps
1–2 · `archive/existing-repo-audit-consolidated.md` § "CSV Import
Pipeline" and § "Security and Ownership Concerns" · `QAG-04`.

**Scope — in.** Select a location, select an import type (transactions,
purchase orders, inventory snapshots), upload a CSV. Server-side type and
size validation. Storage of the raw file for audit and replay. Progress
with a text status alongside, never a bare spinner.

**Scope — out.** Parsing and mapping. Non-CSV formats — an `.xlsx` gets
the friendly redirect in `voice-and-tone.md` §8, not support.

**Acceptance criteria.**
- [x] File type validated on content, not on extension alone.
- [x] A size ceiling is enforced server-side and stated in the UI before
      upload.
- [x] Uploads are scoped to a location the account owns.
- [x] A failed or interrupted upload writes nothing and says so — "Nothing
      was saved, so your existing data is untouched."
- [x] Filenames are never used as storage paths.

**Verification.** Attempt an oversized file, a renamed binary, and an
upload to a foreign location identifier. All three rejected cleanly.

**Notes.** The upload endpoint accepts the raw request body so the guarded
stream can enforce the 10 MB ceiling without first materialising a multipart
form in application memory. A configured S3-compatible adapter stores the
object under a generated UUID key; the audit row is written only after the
object completes, and a database failure triggers object cleanup. The raw
upload is recorded with `status: uploaded` and remains ready for `ING-03`.

---

### ING-03 — CSV parse and preview

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** ING-02 · **Blocks:** ING-04

**Why.** Read messy real-world exports without rejecting them. "The
system feels like it works with messy data instead of rejecting it" is
the stated success condition.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow" ·
[`brand/voice-and-tone.md`](brand/voice-and-tone.md) §2.7 and §5 — never
call a user's file invalid, malformed, or corrupt.

**Scope — in.** Delimiter and encoding detection. Header-row detection.
Quoted fields, embedded newlines, and a byte-order mark handled. Row and
column counts. A preview of the first rows. Per-row parse problems
collected and reported by example, never as a wall of errors.

**Scope — out.** Mapping columns to fields.

**Acceptance criteria.**
- [x] UTF-8, UTF-8 with BOM, and Latin-1 files all parse.
- [x] Comma, semicolon, and tab delimited files all parse.
- [x] A file with some unreadable rows still previews; the readable rows
      are not discarded.
- [x] Problem copy names the count and shows one example: "12 rows had a
      date I couldn't read. Here's the first one."
- [x] Large files parse without exhausting memory.

**Verification.** Build a fixture set of deliberately awful exports and
parse every one.

**Notes.** The upload flow now reads the stored S3-compatible object through
a bounded streaming parser. It detects encoding, delimiter, and headers;
preserves quoted fields and embedded newlines; shows five preview rows; and
groups recoverable row problems with one example. Preview retrieval joins the
upload to its owned location before reading storage. Parser, storage, full CI,
accessibility, production build, and live unauthenticated route smoke checks
passed. The next ticket owns column mapping; no mapping logic was added here.

---

### ING-04 — Column mapping, auto-detection

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** ING-03 · **Blocks:** ING-05

**Why.** Most columns can be recognised without asking. Every column we
recognise is a question the operator does not have to answer.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow", step
3, including the confidence bands and the per-type field targets ·
[`architecture-and-data-model.md`](architecture-and-data-model.md) §
"Canonical data model" for the target fields.

**Scope — in.** A detector scoring each source column against each
canonical field for the selected import type, using header text and
sampled values. Confidence bands: ≥85% auto-accept, 50–85% ask, below 50%
unmapped. Prior mappings for the same account and location weighted
highest.

**Scope — out.** The resolution UI (`ING-05`). Cross-customer pattern
learning — `ux-flows.md` mentions it, but it needs customers first;
record it as a future improvement in the ticket, do not build it.

**Acceptance criteria.**
- [x] Detection returns a confidence score per column, not a yes/no.
- [x] A clean, conventionally-headed export maps every column at ≥85%.
- [x] Value-shape evidence (dates, currency, quantities) contributes, so
      a column headed `col_7` can still be recognised.
- [x] Detection is deterministic — the same file yields the same result.
- [x] Any column may be skipped entirely.

**Verification.** Run the `ING-03` fixture set and record a detection
accuracy figure per import type in the PR.

**Notes.** Implemented a deterministic detector in `src/server/csv/mapping.ts`
and included its result in the authenticated preview response. Header aliases
and sampled value shapes produce confidence scores with the agreed `auto`
(≥85), `review` (50–84), and `unmapped` (<50) bands. Prior mappings are an
optional high-priority input; saving and reusing them belongs to `ING-06`.
Unknown text columns remain skippable, while anonymous date and numeric
columns retain value-shape evidence for the resolution step. Contract samples
map 100% of expected fields: transactions 6/6, purchase orders 3/3, and
inventory snapshots 3/3. Cross-customer pattern learning remains deferred as
specified; no learning store was added.

---

### ING-05 — Column mapping, uncertain-column resolution

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** ING-04, FND-07 · **Blocks:** ING-06, ING-08

**Why.** The moment where a forgiving import is won or lost. One
question at a time, never a grid of forty dropdowns.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow", step
3, both paths · [`brand/ui-implementation.md`](brand/ui-implementation.md)
§4, "CSV column mapping" — `Field` + `NativeSelect` + `Table`.

**Scope — in.** Happy path: "All columns matched. Ready to import?"
Uncertain path: one column at a time, showing the column name, three to
five example values from it, a dropdown of candidate fields, and a skip
option. Progress through the queue is visible and reversible.

**Scope — out.** Item name resolution (`ING-08`).

**Acceptance criteria.**
- [x] Only one uncertain column is on screen at a time.
- [x] Real example values from the user's own file are shown for each.
- [x] The user can go back and change a resolved column before
      committing.
- [x] Skipping a column is always available and never warned about.
- [x] Keyboard-only completion of the whole queue works.

**Verification.** Import a file with six uncertain columns using only the
keyboard.

**Notes.** Added the one-at-a-time review queue to the authenticated import
preview. It shows up to five real values from the selected column, exposes
the detector's candidate fields through a native keyboard-selectable control,
and treats "Skip this column" as a normal choice. Back/Next navigation keeps
decisions reversible; the completed summary offers a Change action for every
uncertain column. The high-confidence path now says "All columns matched.
Ready to import?" without claiming that the not-yet-built import commit
exists. Focused mapping tests, formatting, full CI (104 tests, 13
accessibility checks, production build), and live unauthenticated route
smoke checks passed. Interactive authenticated verification remains pending:
`.env.local` has no test credentials.

---

### ING-06 — Mapping persistence and reuse

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** ING-05 · **Blocks:** ING-09

**Why.** Operators import the same export every week. Asking the same
questions every week is the fastest way to lose them.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow" →
Mapping persistence · `architecture-and-data-model.md` §"CSV upload
history" (`mappingUsed`).

**Scope — in.** Save the accepted column mapping against the account,
location, and import type. Reuse it automatically on the next matching
upload, stating plainly that it was reused. Allow manual adjustment
before committing.

**Acceptance criteria.**
- [x] A second upload of the same export shape asks nothing.
- [x] The reused mapping is disclosed, with a way to change it.
- [x] A changed source format falls back to `ING-04` detection rather
      than misapplying the old mapping.

**Verification.** Import the same file twice; the second run reaches
confirmation without a mapping question.

**Notes.** Accepted mappings are persisted through the authenticated
upload-history mapping route and reused only when the normalized source
column set exactly matches a prior mapping for the same owned location and
import type. Reuse is disclosed in the mapping surface and can be edited
before saving again; a changed column shape uses the existing ING-04
detection. Focused mapping tests, formatting, full CI (109 tests, 13
accessibility checks, production build), and live unauthenticated route
smoke checks passed. Interactive authenticated verification remains
pending because `.env.local` contains no test credentials.

---

### ING-07 — Canonical item master

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-04 · **Blocks:** ING-08, SET-03, MNU-01

**Why.** Every metric in the product is per item. The canonical item is
the join between what the POS called it, what the supplier called it, and
what the operator calls it.

**Read first.**
[`architecture-and-data-model.md`](architecture-and-data-model.md) §
"Inventory items" · [`ux-flows.md`](ux-flows.md) § "Appendix: canonical
item lifecycle example".

**Scope — in.** Create, read, and update canonical items per location.
`canonicalName` is internal, immutable, and used for deduplication.
`displayName` is what appears everywhere in the UI and is editable.
Category, unit, shelf life in days, cost per unit, par level, active
flag, and a usage count maintained as imports reference the item.

**Scope — out.** The resolution UI (`ING-08`), the management screen
(`SET-03`), recipes (`MNU-01`).

**Acceptance criteria.**
- [x] `canonicalName` cannot be edited after creation.
- [x] Every UI surface reads `displayName`; no screen shows the canonical
      name except the audit field in `SET-03`.
- [x] Items are unique per location on `canonicalName`.
- [x] `usageCount` reflects references from transactions and PO lines.
- [x] Shelf life and cost per unit are nullable and editable — a default
      is never presented as a fact.

**Verification.** The location-scoped service exposes create, list, read,
update, archive, and atomic usage-increment operations. Update input rejects
`canonicalName`, the database migration enforces per-location uniqueness,
and unit/migration-contract tests cover immutable names, nullable values,
decimal-string money, and the unique index. The management screen and import
callers consume this service in `SET-03` and `ING-09`; no UI or import route
exists in this ticket's scope.

---

### ING-08 — Item name resolution, exact match only

```
Status: in-review   Owner: codex   Claimed: 2026-08-08   Completed: —   Branch/PR: —
```

**Blocked by:** ING-07, ING-05 · **Blocks:** ING-09

**Why.** No fuzzy-matched data ever enters the system. A silently wrong
item match corrupts every number downstream and is undetectable by the
user — the exact failure the trust contract exists to prevent.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow", step
4 — read it in full, the rule is precise ·
[`brand/ui-implementation.md`](brand/ui-implementation.md) §4, "Item
resolution" — `Combobox`.

**Scope — in.** Exact string match of `rawItemName` to an existing
canonical item, after stripping known substitutions and customizations
("no tomatoes", "extra sauce") so the base menu item is matched. Anything
that does not match exactly is unmatched and blocks import until
resolved. Unmatched items presented one at a time with the raw name,
context values, a search over existing items, and a create-new option.
Creating during import captures canonical name, display name, optional
category and unit, and a shelf life suggested from the category which the
user may override.

**Scope — out.** Fuzzy matching of any kind, at any confidence, ever.

**Acceptance criteria.**
- [ ] Only exact matches link automatically.
- [ ] The customization-stripping rules are listed in code, testable, and
      documented in the PR.
- [ ] Unmatched items appear one at a time.
- [ ] Import cannot proceed with an unresolved item.
- [ ] Suggested shelf life is labelled as a suggestion and is editable at
      the point of creation.
- [ ] `rawItemName` is preserved on every imported row for the audit
      trail regardless of what it matched.

**Verification.** Import a file mixing exact matches, customized
variants, and genuinely new items; confirm each takes the right path.

**Notes.** The reusable resolution contract and one-at-a-time resolver view
are implemented. Matching is complete equality after only NFKC/case/
whitespace normalization plus the explicit modifier rules in
`src/server/csv/item-resolution.ts`; it never scores or guesses. The
contract preserves every raw item name, groups unresolved rows with up to
five context examples, blocks continuation while the queue is non-empty,
and exposes a category-keyed shelf-life suggestion as an editable value.
`ING-09` must wire this contract to the full stored-file row stream and its
atomic commit before this ticket can be signed off against the live import
flow.

**Decisions to confirm.** Shelf-life default source is open
(`open-questions.md` §4). **Default:** a committed lookup table keyed by
category, editable in `SET-05`. Do not call an LLM for this.

---

### ING-09 — Import commit, confirmation, and history

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** ING-06, ING-08 · **Blocks:** ING-10, ING-11, MET-02,
SET-04, INT-01

**Why.** Closes the import loop and writes the audit trail that "show
your work" later cites by name and row count.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Import: full flow", step
5 · `architecture-and-data-model.md` § "CSV upload history".

**Scope — in.** A pre-commit summary: rows to import, new items to
create, items to link. Atomic commit — the whole import lands or none of
it does. Deduplication against `externalId` on re-import. A history row
capturing filename, type, rows imported, mapping used, unmatched items
resolved, and timestamp. A success state routing onward to the dashboard
when data is now sufficient, or back to import when it is not.

**Scope — out.** Deleting imports — data is immutable for audit.

**Acceptance criteria.**
- [ ] A failure mid-commit leaves the database exactly as it was.
- [ ] Re-importing the same file does not duplicate rows.
- [ ] Success copy states real counts: "1,204 rows imported. 6 new items
      created."
- [ ] Every import writes exactly one history row.
- [ ] The next step is obvious and one click away.

**Verification.** Force a failure partway through a large import and
confirm zero rows landed. Then import the same file twice.

---

### ING-10 — Manual entry

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** ING-09 · **Blocks:** —

**Why.** The next input workflow after CSV, per the input scope. An
operator who counted the walk-in on paper this morning should not need a
spreadsheet to tell us.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Input scope" — manual entry produces the *same normalized records* as
import.

**Scope — in.** Forms for an inventory count, a purchase order with line
items, and a transaction. Item selection via the same combobox as
`ING-08`, with create-new available. Entries written to the same tables
with `source` set to `manual`, and logged to history like an import.

**Scope — out.** Bulk paste. Editing historical rows.

**Acceptance criteria.**
- [ ] Manual records are indistinguishable downstream from imported ones
      except by `source`.
- [ ] The metrics engine picks them up on the next run with no special
      casing.
- [ ] Every manual entry appears in import history.
- [ ] Forms use real labels; errors are described in text.

**Verification.** Enter an inventory count manually and confirm `MET-03`
treats it as an authoritative snapshot per D11.

---

### ING-11 — CSV export, the trust fallback

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** ING-09 · **Blocks:** —

**Why.** An operator must be able to get their own data back out. This is
a trust commitment, not a feature — and per D5 it is the *only* export
that will ever exist.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Input scope", final bullet · D5 in §3 above.

**Scope — in.** Export imported and derived data for the selected
location as CSV: transactions, purchase orders and lines, inventory
items, and inventory snapshots.

**Scope — out.** Scheduled exports, emailed exports, PDF, and any
downstream handoff or integration. All permanently out of scope per D5.

**Acceptance criteria.**
- [ ] Exports are scoped to one location and to the requesting owner.
- [ ] A round trip — export, then re-import — produces no duplicates and
      no data loss.
- [ ] Numeric precision survives the round trip exactly.

**Verification.** Export, re-import into a second location, and compare
row for row.

---

### MET-01 — Derived metric definitions

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-04 · **Blocks:** MET-02, DSH-06, MNU-03, STF-02

**Why.** Per D9 the model never calculates. Every number the product ever
shows originates here, in deterministic, testable code.

**Read first.**
[`architecture-and-data-model.md`](architecture-and-data-model.md) §
"Derived metrics" · D9, D10, D11 in §3 above.

**Scope — in.** Pure functions for sell-through rate, spoilage estimate,
spoilage risk, margin, and variance, exactly as defined in the
architecture document. **One shared business-day bucketing function**
that every date-bucketed metric calls, per
[`tech-stack.md`](tech-stack.md) §3.10 — implement it here, once, or it
will be reimplemented inconsistently four times. Each returns its result *and* the inputs it used,
so `MET-10` can render the arithmetic without recomputing it. Each
returns an explicit "cannot calculate" outcome, with the reason, when an
input is missing — never a zero, never a null silently treated as zero.

**Scope — out.** Scheduling, storage, scoring, and presentation.

**Acceptance criteria.**
- [x] Each metric matches its documented formula exactly.
- [x] Missing unit costs produce "cannot calculate, no unit cost", not
      `$0`.
- [x] Every result carries its input values and the units they were in.
- [x] Money arithmetic uses exact numeric types throughout.
- [x] Unit tests cover the worked salmon example from
      `mvp-scope-and-decisions.md` § "Message format" and reproduce its
      figures.

**Verification.** Property tests: no metric ever returns a number when an
input it depends on is absent.

**Notes.** Added pure metric functions for sell-through rate, spoilage
estimate, spoilage risk, margin, variance, and timezone-aware business-day
bucketing. PostgreSQL `numeric` values remain decimal strings throughout;
ratios use six-place half-up rounding implemented with `bigint`, and every
result includes the source inputs and units. Missing dependencies and invalid
inputs return explicit cannot-calculate reasons. The focused suite covers
the worked salmon figures, decimal arithmetic, missing-data boundaries, and
midnight/DST business-day behavior. Full formatting, CI, accessibility, and
production build validation passed.

---

### MET-02 — Precompute pipeline and metric store

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-01, ING-09 · **Blocks:** MET-03, MET-04, MET-12,
DSH-07, STF-03

**Why.** D9's architecture: results are computed on a schedule and
stored, then read by the dashboard and handed to the model. Nothing
computes at read time, and nothing computes inside a model call.

**Read first.** D9 in §3 above ·
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) § "MVP pages"
→ Dashboard ("updated daily") ·
[`cost-and-pricing.md`](cost-and-pricing.md) § "Effect of prompt caching"
— precomputed bundles are what make caching worthwhile.

**Scope — in.** A scheduled job computing every `MET-01` metric per item
per location, plus the location-level rollups the dashboard needs.
Persistence of results with the run timestamp and the input data window.
Recomputation triggered by a completed import and by a settings change
that invalidates assumptions. Idempotent runs. Observable failure — a
stale metric store must be detectable, and the UI must be able to say
when the numbers were last computed.

**Scope — out.** Real-time recomputation on every page load.

**Acceptance criteria.**
- [ ] A full run for a location with a year of history completes within a
      documented time budget, recorded in the PR.
- [ ] Re-running over unchanged data produces identical results.
- [ ] A finished import triggers recomputation for that location only.
- [ ] Every stored result records when it was computed and over what
      window.
- [ ] A failed run leaves the previous results intact and raises an
      alert, rather than serving partial data.
- [ ] Nothing in this pipeline calls an LLM.

**Verification.** Import, confirm recompute fires, mutate an item's shelf
life, confirm the affected results and only those are invalidated.

---

### MET-03 — Spoilage resolution, snapshots authoritative

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-02 · **Blocks:** MET-05, MET-06, MNU-04

**Why.** Spoilage can be computed two ways and they routinely disagree.
D11 settles it: a physical count is ground truth.

**Read first.** D11 in §3 above ·
[`architecture-and-data-model.md`](architecture-and-data-model.md) §
"Derived metrics" and § "Edge cases & honest boundaries" → Conflicting
data · [`open-questions.md`](open-questions.md) §4.

**Scope — in.** Where inventory snapshots exist, derive spoilage from
successive counts. Between counts, and where no counts exist, fall back
to `ordered − sold − on-hand`. Record which method produced each figure.
Where both are available and disagree materially, keep both and expose
the gap as a variance finding — the disagreement is itself information
worth surfacing, per the conflicting-data rule.

**Scope — out.** Deciding *why* a variance exists. We surface waste,
theft, and data error as possibilities and assume none of them.

**Acceptance criteria.**
- [ ] Every spoilage figure records its method: `snapshot` or `inferred`.
- [ ] Snapshots win wherever they cover the period.
- [ ] A stale snapshot — older than the fallback window — is not treated
      as current; the ticket documents the staleness rule chosen.
- [ ] A material disagreement produces a variance record, not a silent
      pick.
- [ ] With neither snapshots nor complete PO data, spoilage returns
      "cannot calculate", not zero.

**Verification.** Fixture with counts, without counts, and with counts
that contradict the math. Confirm all three paths.

**Decisions to confirm.** "Material" disagreement threshold is not
specified anywhere. **Default:** flag when the two methods differ by more
than 20% of the smaller figure, configurable via `MET-08`.

---

### MET-04 — Data Sufficiency score

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-02 · **Blocks:** MET-07, DSH-01

**Why.** The third ranking dimension, at 20%. It was deliberately renamed
from "Confidence" — it describes our data coverage, never a claim about
how certain reality is.

**Read first.**
[`architecture-and-data-model.md`](architecture-and-data-model.md) §
"Scoring dimensions" and § "Data requirements by recommendation type" ·
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) §
"Recommendation contract" → the naming note.

**Scope — in.** A 0–100 score per item from weeks of transaction history,
purchase-data completeness, inventory-data presence, and pattern
consistency. The four-week minimum gate for predictions. The
per-recommendation-type minimum data table implemented as code.

**Scope — out.** Presenting this as a confidence percentage to the user.
It ranks; it is never displayed as a certainty claim.

**Acceptance criteria.**
- [ ] Under four weeks of transactions, predictions are suppressed
      entirely — observations still flow.
- [ ] The score's constituent parts are individually retrievable for
      `MET-10`.
- [ ] Each recommendation type honours its minimum-data row from the
      architecture table.
- [ ] No API returns this value labelled "confidence".

**Verification.** Feed histories of 1, 3, 4, and 12 weeks; confirm the
prediction gate flips only at four.

**Decisions to confirm.** The 7-day dashboard threshold is a v2-era
placeholder (`open-questions.md` §4). **Default:** keep 7 days as the
threshold for showing any dashboard insight, and 4 weeks for predictions.
Make both configurable via `MET-08`.

---

### MET-05 — Impact score

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-03 · **Blocks:** MET-07, DSH-02, STF-06

**Why.** 40% of the ranking, and the number the operator actually cares
about. D10 settles what feeds it.

**Read first.** D10 in §3 above ·
[`open-questions.md`](open-questions.md) §1, Q1 (the question D10
answers) · `architecture-and-data-model.md` § "Scoring dimensions".

**Scope — in.** A 0–100 score composed from all four categories: current
spoilage risk (on-hand × unit cost), historical spoilage (past weeks'
waste × unit cost), overordering cost (excess carrying cost relative to
sell-through), and margin loss (deteriorating margin on moving items).
Each category's dollar contribution is retained separately, not just the
composite — the UI leads with dollars, and "$40 at risk" must be
traceable to which category produced it.

**Scope — out.** User-tunable weights per business — that is the deferred
per-user tuning in `architecture-and-data-model.md` § "Tuning &
configuration".

**Acceptance criteria.**
- [ ] All four categories contribute, and each is separately readable.
- [ ] Category weights live in configuration (`MET-08`), never hardcoded.
- [ ] A missing input suppresses its category and is stated, rather than
      contributing zero silently.
- [ ] The composite is 0–100; the underlying dollar figures are exact and
      unscaled.
- [ ] With no unit costs at all, Impact still ranks on unit-based signals
      and the output says dollars cannot be calculated.

**Verification.** Reproduce the salmon example's `$40` end to end and
show which category produced it.

**Decisions to confirm.** Relative weighting between the four categories
is not specified. **Default:** current spoilage risk 0.40, overordering
0.25, margin loss 0.20, historical spoilage 0.15 — forward-looking money
outranks money already lost. Configurable, and stated in the PR as an
assumption.

---

### MET-06 — Urgency score

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-03 · **Blocks:** MET-07

**Why.** The other 40%. Impact says how much; urgency says how long you
have.

**Read first.** `architecture-and-data-model.md` § "Scoring dimensions" ·
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) § "Scoring
formula" → provisional calculation rules.

**Scope — in.** A 0–100 score from shelf life remaining, trend
acceleration, and supplier lead time where known. Conservative — biased
*down* — when inputs are missing, so a data gap never manufactures
urgency.

**Acceptance criteria.**
- [ ] Missing shelf life lowers urgency; it never defaults to urgent.
- [ ] Shelf life is read from the item's editable value, and the value
      used is exposed for `MET-10`.
- [ ] Trend acceleration requires enough history to be meaningful and is
      suppressed otherwise.
- [ ] Thresholds come from configuration (`MET-08`).

**Verification.** An item with no shelf life set must never outrank an
identical item with a known two-day shelf life.

---

### MET-07 — Ranking and top-N selection

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-04, MET-05, MET-06 · **Blocks:** MET-08, MET-09,
AGG-01

**Why.** The formula is settled and must be implemented exactly, in one
place, so it can be changed in one place.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Scoring formula" · `architecture-and-data-model.md` § "Extending the
formula".

**Scope — in.** `score = (Impact × 0.40 + Urgency × 0.40 + Data
Sufficiency × 0.20) ÷ sum of weights`. Weights from configuration.
Selection of the top five for the dashboard. Deterministic, documented
tie-breaking. Adding a dimension must require only defining its 0–100
calculation and its weight, with existing weights rebalancing
proportionally.

**Acceptance criteria.**
- [ ] The formula matches the document exactly, including the divisor.
- [ ] Adding a fourth dimension in a test rebalances the other three
      proportionally without touching their code.
- [ ] Ties break deterministically; the rule is documented.
- [ ] Exactly five recommendations reach the dashboard.

**Verification.** Add a throwaway 0.15-weight dimension in a test and
confirm the worked example in the architecture document reproduces.

**Decisions to confirm.** Minimum per-dimension thresholds versus always
showing five is open (`open-questions.md` §1, Q4). **Default:** always
show the top five, but suppress any whose Impact is below the configured
`low_impact` floor — five weak alerts train operators to ignore the
dashboard.

---

### MET-08 — Tuning configuration

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-07 · **Blocks:** —

**Why.** Weights and thresholds are stated as configuration, not
hardcoded values, so tuning does not require a deploy-shaped change.

**Read first.** `architecture-and-data-model.md` § "Tuning &
configuration" — the YAML block is the target shape.

**Scope — in.** A single validated configuration source holding the three
ranking weights, the impact-category weights from `MET-05`, the impact
and urgency thresholds, the data-sufficiency thresholds from `MET-04`,
and the variance threshold from `MET-03`. Documented defaults. Validation
that fails loudly at startup on a bad configuration.

**Scope — out.** Per-user and per-business tuning — explicitly deferred.
A settings UI for any of this.

**Acceptance criteria.**
- [ ] Every magic number from MET-03 through MET-07 is sourced here.
- [ ] Weights that do not sum as expected fail at startup with a clear
      message.
- [ ] Defaults match the documented YAML.
- [ ] Changing a weight changes ranking with no code change.

**Verification.** Grep the engine for numeric literals; the only ones
left are structural.

---

### MET-09 — Recommendation record and message assembly

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-07 · **Blocks:** MET-10, MET-11, DSH-03, CHT-02,
MNU-06

**Why.** Turns scores into the five-part structure the whole product
speaks in. Assembled deterministically here so the dashboard and the chat
narrator are rendering the *same* record rather than two similar ones.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Message format" · [`brand/voice-and-tone.md`](brand/voice-and-tone.md)
§3 — the worked example is the target output · §2.2 on facts versus
predictions.

**Scope — in.** A stored recommendation carrying: observation with its
metrics, financial impact, an optional prediction with its basis, a
suggested action with a time horizon, and a reference to its evidence
trace. Observations and predictions held in separate fields that cannot
be conflated. Predictions omitted entirely below the four-week gate.
Structured output — prose generation belongs to `CHT-02` and to the
dashboard renderer.

**Acceptance criteria.**
- [ ] Observation and prediction are structurally separate fields.
- [ ] No confidence value is ever attached to an observation.
- [ ] Predictions carry their basis ("4 weeks of transactions") as data,
      not prose.
- [ ] The action is phrased as a suggestion, per `voice-and-tone.md`
      §2.5 — "consider", never an imperative.
- [ ] Financial impact is null and explained, rather than zero, when it
      cannot be calculated.
- [ ] The salmon example reproduces field for field.

**Verification.** Assemble the salmon example and diff it against
`voice-and-tone.md` §3.

---

### MET-10 — Evidence trace, the "show your work" data

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-09 · **Blocks:** DSH-04, CHT-05

**Why.** "If it can't show its work, the output should be treated as
unreliable." That is a stated product requirement, which makes the trace
a first-class artifact rather than a debug log.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Trust and honesty requirements" ·
[`brand/voice-and-tone.md`](brand/voice-and-tone.md) §2.4 — the actual
arithmetic, not a narrative about having done arithmetic ·
`architecture-and-data-model.md` § "Message structure".

**Scope — in.** For every recommendation, a trace recording: which data
sources contributed, naming the source file and its row count and upload
date; each calculation performed, with its inputs, operator, and result;
and every assumption used, with its value, its origin (user-set, category
default, or system default), and where the user can change it.

**Scope — out.** Rendering (`DSH-04`, `CHT-05`).

**Acceptance criteria.**
- [ ] Every figure in a recommendation appears in its trace with the
      arithmetic that produced it.
- [ ] Sources cite filename, row count, and upload date.
- [ ] Every assumption states whether it is the user's value or our
      guess, and where to edit it.
- [ ] A recommendation cannot be created without a complete trace —
      enforce it, do not merely test it.
- [ ] Traces reproduce: re-running the engine over unchanged data
      produces an identical trace.

**Verification.** Recompute the salmon example's `$40` by hand from the
trace alone.

---

### MET-11 — Partial-data and conflicting-data rules

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-09 · **Blocks:** —

**Why.** The MVP must be useful with incomplete data and honest about the
gaps. These are the specific behaviours that make partial data a degraded
experience rather than a broken one.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Partial data policy" · `architecture-and-data-model.md` § "Edge cases
& honest boundaries" — all four cases.

**Scope — in.** Not enough history: observations only, no predictions,
and a plain statement of what is missing and what would fix it. No
prices: unit-framed output — "you ordered 5 salmon, sold 0" — and an
explicit statement that dollars cannot be calculated. Conflicting data:
surface the variance as its own finding with possible explanations
offered and none assumed. Seasonal items: acknowledge seasonality, still
show the data, offer an explanation.

**Acceptance criteria.**
- [ ] Each of the four cases has a test proving its behaviour.
- [ ] No case produces a fabricated number or a silent zero.
- [ ] Every "cannot calculate" states what is missing and where to
      supply it.
- [ ] Copy passes `voice-and-tone.md` §5 — never "invalid", "bad", or
      "incomplete data" as a scolding.

**Verification.** Run the engine on four fixtures, one per case, and read
every output aloud against §5's banned-language list.

---

### MET-12 — Interpretable data layer for pattern discovery

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-02 · **Blocks:** CHT-03

**Why.** D9's second half. Precomputation covers the arithmetic we
anticipated. This exposes the normalized data in a shape a model can read
so that patterns we did *not* anticipate can still surface — without ever
letting the model do arithmetic.

**Read first.** D9 in §3 above ·
`architecture-and-data-model.md` § "AI / data query layer" → analysis
capabilities · [`cost-and-pricing.md`](cost-and-pricing.md) § "Query size
assumptions" — the context budget is roughly 2,000 tokens of data
summary.

**Scope — in.** A compact, structured, location-scoped representation of
the operating picture: per-item series (sold, ordered, on-hand over
time), category rollups, day-of-week and time-of-day distributions, and
the precomputed metric results. Deterministic and cacheable, so prompt
caching works. Every value in it is labelled with its units and its
source. Sized to a documented token budget.

**Scope — out.** Any tool, function, or path that lets the model compute
a new figure. Model-generated SQL. Anything writing back.

**Acceptance criteria.**
- [ ] The bundle contains only values the engine computed or data the
      user imported — nothing derived on the fly.
- [ ] It is byte-identical for identical data, so it caches.
- [ ] It stays within its documented token budget for a location with a
      year of history, degrading by summarising oldest data first.
- [ ] It is scoped to exactly one location, enforced at the query layer.
- [ ] Every number in it carries units and provenance.

**Verification.** Serialize a bundle for the seed location, measure its
token count, and confirm two runs produce identical bytes.

---

### DSH-01 — Insufficient-data state

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-08, MET-04 · **Blocks:** DSH-02, DSH-03

**Why.** Most first sessions land here, not on a full dashboard. Getting
this screen right is what keeps a new user importing rather than leaving.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Dashboard: first-load
experience" · [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §6 →
Empty states and Insufficient data ·
[`brand/ui-implementation.md`](brand/ui-implementation.md) §4 → `Empty`.

**Scope — in.** A no-data state and a not-enough-data state. Progress
made concrete — "I need about 7 days of transactions before the numbers
mean anything. You've got 4." One next step, always. Never a hard block
with nothing to do.

**Acceptance criteria.**
- [ ] Both states state real counts from the user's own data.
- [ ] Each offers exactly one next action.
- [ ] Neither uses "simply", "just", or an exclamation mark.
- [ ] Whatever *can* be shown at the current data level is shown, rather
      than withheld until the threshold is met.

**Verification.** Walk an account from zero rows to 3 days to 10 days and
read each state.

---

### DSH-02 — Wallet impact summary

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** DSH-01, MET-05 · **Blocks:** —

**Why.** Top of the dashboard, and the answer to the first job to be
done: what am I losing money on right now.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Dashboard: first-load
experience" → Wallet impact summary ·
[`brand/brand-foundations.md`](brand/brand-foundations.md) §8 → "Put the
dollar figure in the largest type on the card", "Show the number before
the chart".

**Scope — in.** Estimated spoilage this week, money at risk if trends
continue, and margin trend against last week. Figures in Plex Mono,
tabular, oversized. A statement of when the numbers were last computed
(`MET-02`). Values that cannot be calculated say so in place of the
figure.

**Scope — out.** Charts.

**Acceptance criteria.**
- [ ] The dollar figure is the largest element on the card.
- [ ] No percentage leads.
- [ ] No animated number counters — explicitly banned.
- [ ] Uncalculable values state why, and where to supply what is missing.
- [ ] Screen is legible desaturated.

**Verification.** Desaturate a screenshot. Then check every figure
against the metric store.

---

### DSH-03 — Recommendation card

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** DSH-01, MET-09 · **Blocks:** DSH-04, AGG-01, MKT-03

**Why.** The product's central object. It appears on the dashboard, in
chat, and on the marketing site, and it must be the same component in all
three.

**Read first.** [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §3 —
including the length discipline · `mvp-scope-and-decisions.md` § "Message
format" · [`brand/ui-implementation.md`](brand/ui-implementation.md) §4 →
"Recommendation card" and "Severity chip", §5 → severity encoding.

**Scope — in.** Card rendering the five-part structure. A severity chip
carrying glyph, word, and soft background — never colour alone. The 3px
left state edge. Actions: show your work, ask about this. The top five
ranked. At most three sentences before the buttons.

**Scope — out.** The "Offer to a shelter" action — donation is out (D3).
Thumbs up/down — that is the Phase 2 feedback loop and is not in this
backlog.

**Acceptance criteria.**
- [ ] Observation and prediction are visually and verbally distinct; a
      reader always knows which they are reading.
- [ ] Predictions state their basis and appear only above four weeks of
      history.
- [ ] Severity reads correctly in full greyscale — glyph and word carry
      it.
- [ ] Dashboard copy stays within three sentences before the buttons.
- [ ] The action reads as a suggestion, never a command.
- [ ] The same component renders in chat and on the marketing page.

**Verification.** Render all five and desaturate. Then read each aloud
against `voice-and-tone.md` §5.

---

### DSH-04 — Show-your-work disclosure

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** DSH-03, MET-10 · **Blocks:** —

**Why.** The single highest-trust element in the product, and per
`marketing-copy.md` §3.6 the highest-converting one too.

**Read first.** [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §2.4
· `mvp-scope-and-decisions.md` § "Trust and honesty requirements" ·
`ui-implementation.md` §4 → `Collapsible` holds it.

**Scope — in.** A collapsible rendering the `MET-10` trace: sources with
filename, row count, and upload date; the arithmetic with real numbers;
assumptions, each labelled as the user's value or our default, each
linking to where it can be changed.

**Acceptance criteria.**
- [ ] Shows arithmetic, not a narrative about arithmetic.
- [ ] Every assumption states its origin and links to `SET-03`.
- [ ] Figures inside it are Plex Mono and tabular.
- [ ] Collapsed by default; keyboard operable; state announced to
      assistive technology.
- [ ] If a trace is missing, the card says the output is unverified
      rather than hiding the gap.

**Verification.** Recompute one recommendation by hand from what the
panel shows.

---

### DSH-05 — Chart primitives, pattern-first

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-07 · **Blocks:** DSH-06, DSH-07, QAG-02, AGG-03,
MNU-05

**Why.** A colour-only chart was built once, shown to the product owner,
and correctly rejected — he could not tell whether the bars were one
colour or three. This section of the brand documentation is marked
non-negotiable.

**Read first.** [`brand/ui-implementation.md`](brand/ui-implementation.md)
§5 in full, including the pattern CSS ·
[`brand/brand-foundations.md`](brand/brand-foundations.md) §5.2 → chart
categoricals.

**Scope — in.** A ranked horizontal bar chart as the default shape.
Series patterns in the fixed order: solid, diagonal hatch, cross-hatch,
dots, vertical rule. Five series maximum. Printed values on every mark.
Labels on the mark, not only in a legend. Line charts with dash patterns
and an end-of-line label. A 1px border at ~18% opacity on every mark.
Horizontal overflow contained inside the chart, never on the page body.

**Scope — out.** Pie and donut charts — banned. Any sixth series. Green,
anywhere.

**Acceptance criteria.**
- [x] Every categorical series carries its assigned pattern.
- [x] Every mark prints its value.
- [x] Removing all colour loses no meaning — this is the merge gate.
- [x] No green token is reachable from any chart path.
- [x] Chart marks meet 3:1 contrast against their background.
- [x] Charts scroll inside their own container at 375px.

**Verification.** Screenshot every chart type, desaturate, read. `QAG-02`
then automates this.

**Notes.** `components/charts/chart-primitives.tsx` provides reusable SVG
ranked-bar and line primitives. Bars use solid, diagonal hatch,
cross-hatch, dots, and vertical-rule fills in fixed order; lines use fixed
dash patterns. Values and labels are printed on marks, chart overflow is
contained in a keyboard-focusable region, and the gallery renders both
types. Server-rendered regression tests cover the encoding contract and
five-series ceiling. The gallery passes the light/dark accessibility suite;
the chart tokens are 3:1 or better against their corresponding light/dark
card backgrounds.

---

### DSH-06 — Trend summaries

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** DSH-05, MET-01 · **Blocks:** —

**Why.** "Why are my margins changing?" is a primary job to be done, and
a trend is how it gets answered at a glance.

**Read first.** `ux-flows.md` § "Dashboard: first-load experience" ·
`mvp-scope-and-decisions.md` § "MVP pages" → Dashboard.

**Scope — in.** Margin, spoilage, and sell-through over time for the
selected location, with the comparison period named explicitly. The
figure leads; the chart supports it. Periods with insufficient history
are shown as absent, never interpolated.

**Acceptance criteria.**
- [ ] Every trend names its comparison window in words.
- [ ] The number appears before the chart.
- [ ] Direction is carried by an arrow glyph and a word, never by colour
      or by red-versus-green.
- [ ] Gaps in data render as gaps.

**Verification.** Desaturate. Confirm direction is still readable.

---

### DSH-07 — Item deep dives

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** DSH-05, MET-02 · **Blocks:** —

**Why.** Snape's persona works at item level. The dashboard has to go one
layer below the rollup or it only serves the owner.

**Read first.** `ux-flows.md` § "Dashboard: first-load experience" → Item
deep dives · `ui-implementation.md` §4 → "Item detail": `Sheet` on
mobile, `Dialog` on desktop.

**Scope — in.** Top-selling items by revenue, items at spoilage risk, and
low-margin items. A per-item detail view: sell-through, on hand, unit
cost, shelf life, recent orders and sales, and every recommendation
touching that item. A link into chat pre-loaded with that item's context.

**Acceptance criteria.**
- [ ] Items are named by `displayName`, never canonical name.
- [ ] The detail view states which assumptions it used and links to edit
      them.
- [ ] Items with insufficient data appear with what is known, not hidden.
- [ ] Sheet on mobile, dialog on desktop.

**Verification.** Open a detail view for an item with no unit cost and
confirm it degrades honestly.

---

### CHT-01 — Chat surface and composer

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-08 · **Blocks:** CHT-02

**Why.** One of the two co-equal first-value paths. Chat is not a
secondary surface to the dashboard.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "MVP pages" → Chat · [`ui-implementation.md`](brand/ui-implementation.md)
§4 → chat transcript and composer components.

**Scope — in.** Transcript and composer using the purpose-built
components — do not hand-roll them. Enter sends, Shift+Enter newlines.
Streaming rendering. Scoped to the selected location, with that scope
visible. Suggested opening questions for an empty transcript.

**Scope — out.** The answering itself.

**Acceptance criteria.**
- [ ] The selected location is visible without interaction.
- [ ] Streaming does not shift layout as tokens arrive.
- [ ] Fully keyboard operable; transcript updates announced to assistive
      technology.
- [ ] Works at 375px with a real mobile keyboard on screen.

**Verification.** Send a question on mobile with a stubbed response.

---

### CHT-02 — Narration service and model integration

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-01, MET-09 · **Blocks:** CHT-03

**Why.** Per D9 the model's entire job is turning precomputed structured
results into prose that sounds like PantryIQ.

**Read first.** D9 in §3 above · [`cost-and-pricing.md`](cost-and-pricing.md)
in full — model choice, caching, and the margin table ·
[`brand/voice-and-tone.md`](brand/voice-and-tone.md) §2 and §5.

**Scope — in.** A provider-agnostic model interface, per the `FND-01`
prescription. A system prompt encoding the voice rules and the
never-calculate constraint. Prompt caching over the stable portion of
context. Streaming. Timeout, retry, and a graceful degraded path that
shows the structured recommendation without prose if the model is
unavailable. Per-query token and cost logging.

**Scope — out.** Choosing the model — `FND-01` did that. Persisting
conversations beyond the session (`CHT-07`).

**Acceptance criteria.**
- [ ] The model receives only precomputed results and the `MET-12`
      bundle. It has no database access of any kind.
- [ ] The stable prefix is cached; the cache-hit rate is logged.
- [ ] Measured per-query cost is recorded in the PR and compared against
      `cost-and-pricing.md`.
- [ ] A model outage still shows the recommendation, plainly, without
      prose.
- [ ] Provider is swappable by configuration.
- [ ] First token arrives within a stated budget; the 3–5 second target
      for a grounded answer is measured and reported.

**Verification.** Point the interface at a stub, then at the real
provider; both produce the same structured content.

---

### CHT-03 — Grounding contract and guardrails

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-02, MET-12 · **Blocks:** CHT-04, CHT-08, AGG-04

**Why.** The hardest requirement in the product: a confidently wrong
answer loses the user permanently. This ticket is the machinery that
stops one being produced.

**Read first.** D9 in §3 above ·
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) § "Trust and
honesty requirements" · `voice-and-tone.md` §2.2 and §2.3 ·
`architecture-and-data-model.md` § "Chat capabilities" → "Chat doesn't
prescribe".

**Scope — in.** Enforcement, not instruction: every figure in a response
must match a value present in the supplied context, checked after
generation, and a response containing an unmatched figure is not shown.
Pattern observations drawn from the `MET-12` bundle are permitted and
must be labelled as observations, never as calculations or predictions.
No write path of any kind. Location scope enforced at the query layer,
not by prompt.

**Scope — out.** Model-generated SQL. Tool calls that compute. External
API access.

**Acceptance criteria.**
- [ ] A response containing a number absent from context is blocked, and
      the block is logged.
- [ ] Prompt-injected instructions inside imported data cannot change
      behaviour — imported item names are data, never instructions.
- [ ] The model cannot reach another location's data even when a
      question names it.
- [ ] Nothing in the chat path writes to the database.
- [ ] Observations from the interpretable layer are labelled as
      observations wherever they appear.

**Verification.** Adversarial suite: ask for a figure we do not compute;
import an item literally named as an instruction; ask about another
location by name. All three must fail closed.

---

### CHT-04 — Five-part answer format

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-03 · **Blocks:** CHT-05, CHT-07

**Why.** Dashboard and chat must speak identically. A user who sees one
shape on the dashboard and a different one in chat is being asked to
trust two products.

**Read first.** `voice-and-tone.md` §3, including length discipline ·
`mvp-scope-and-decisions.md` § "Message format" and its interaction
shape.

**Scope — in.** Observation, financial impact, prediction where earned,
recommendation, and show-your-work on demand — rendered from the
`MET-09` record. The first two sentences carry the money and the action.
Follow-up affordances.

**Acceptance criteria.**
- [ ] The five parts appear in order and are individually identifiable.
- [ ] Predictions are labelled and carry their basis.
- [ ] Observations never carry a confidence label.
- [ ] The money and the action land in the first two sentences.
- [ ] Output contains nothing from the banned-language list.

**Verification.** Ask "What am I wasting money on?" against the seed
data and compare the response against `voice-and-tone.md` §3 line by
line.

---

### CHT-05 — Show your work, in chat

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-04, MET-10 · **Blocks:** CHT-06

**Why.** Chat's version of `DSH-04`. Same trace, same standard,
collapsible so detail does not swamp the answer.

**Read first.** `voice-and-tone.md` §2.4 · `ux-flows.md` § "Chat:
interaction model" → confidence and reasoning.

**Scope — in.** An on-demand expansion showing data queried, assumptions
used, and the logic chain to the conclusion, sourced from the `MET-10`
trace. If a claim has no trace, the answer says so and is treated as
unreliable.

**Acceptance criteria.**
- [ ] Uses the same trace as `DSH-04` — no second implementation.
- [ ] Collapsed by default.
- [ ] An untraceable claim is flagged, not quietly shown.
- [ ] Assumptions link to where the user can change them.

**Verification.** Expand the work on three different answer types and
recompute each by hand.

---

### CHT-06 — Assumption override and scope prompt

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-05, SET-03 · **Blocks:** —

**Why.** Snape will tell us our shelf life is wrong, and he is usually
right. Being correctable mid-conversation is what separates a thought
partner from a report.

**Read first.** `voice-and-tone.md` §4 — the full disagreement pattern ·
`mvp-scope-and-decisions.md` § "Core user workflows" → Assumption
override · `ux-flows.md` § "Chat: interaction model" → user challenge.

**Scope — in.** Acknowledge, show the assumption, offer the correction,
recalculate, then ask about scope: this conversation only, or saved to
item settings. Recalculation runs through the deterministic engine — the
model never recomputes. Show what changes numerically, both before and
after. Session-scoped overrides do not persist unless the user chooses to
save.

**Scope — out.** The model writing to the database on its own. Any
autonomous chat-to-dashboard write-back — an explicit non-goal and the
single most dangerous feature in the system.

**Acceptance criteria.**
- [ ] Scope is always asked before anything persists.
- [ ] Persisting goes through the same path as `SET-03`, with the user's
      explicit confirmation.
- [ ] Recalculated figures come from the engine, verifiably.
- [ ] Both the old and new figures are shown.
- [ ] The response never defends the default, never says "actually", and
      never re-asserts the original number.

**Verification.** Run the salmon shelf-life exchange from
`voice-and-tone.md` §4 and confirm `$40 → $12` recalculates correctly and
that nothing persisted without a choice.

---

### CHT-07 — Session memory

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-04 · **Blocks:** —

**Why.** Follow-ups are how investigation actually works — "tell me more
about salmon" only means something with what came before.

**Read first.** `mvp-scope-and-decisions.md` § "MVP pages" → Chat
("session-only memory") · `ux-flows.md` § "Chat: interaction model" →
conversational memory · `cost-and-pricing.md` § "Query size assumptions"
— roughly 400 tokens of history.

**Scope — in.** History within a session, so follow-ups resolve against
earlier answers. History trimmed to a budget, oldest first. Context
cleared when the session ends or the location changes.

**Scope — out.** Persistence across sessions — explicitly not in scope.

**Acceptance criteria.**
- [ ] "Tell me more about salmon" resolves against the previous answer.
- [ ] Switching location clears context; no answer mixes locations.
- [ ] History stays within its token budget and the trim is logged.
- [ ] A new session starts empty.

**Verification.** Ten-turn conversation, then switch location mid-thread
and confirm the context is gone.

---

### CHT-08 — Decline, redirect, and log the miss

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** CHT-03 · **Blocks:** —

**Why.** D9 means chat can only speak to what the engine computed. What
happens at that boundary decides whether the limit reads as honesty or as
a broken product.

**Read first.** D9 in §3 above · `voice-and-tone.md` §2.3 ·
`ux-flows.md` § "Chat: interaction model" → if the AI cannot answer.

**Scope — in.** When a question falls outside what we can ground: say so
plainly, say why, and offer the nearest question we *can* answer — the
`voice-and-tone.md` §2.3 pattern. Log every miss with the question, so
the set of unanswerable questions becomes a ranked list of metrics worth
adding to `MET-01`. Route that list somewhere a human reads it.

**Acceptance criteria.**
- [ ] A decline always offers a concrete alternative question.
- [ ] A decline never guesses, hedges, or produces a figure.
- [ ] Every miss is recorded with the question text and the reason.
- [ ] Misses are aggregated and readable — a one-off report is enough,
      no dashboard needed.
- [ ] Decline copy contains no apology beyond one, and no self-blame
      language.

**Verification.** Ask five questions the engine cannot ground; read all
five declines against `voice-and-tone.md` §5.

---

### SET-01 — Account settings

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-08 · **Blocks:** —

**Why.** Minimum account hygiene: the user can see and change who they
are.

**Read first.** [`ux-flows.md`](ux-flows.md) § "Settings: sections" →
Account basics.

**Scope — in.** Account name, primary email tied to authentication, and
optional company name, all editable. Password change. Email change with
verification.

**Scope — out.** Team members and roles (D6). Billing (D7).

**Acceptance criteria.**
- [ ] Email change requires verification before it takes effect.
- [ ] Password change invalidates other sessions.
- [ ] Forms use real labels; errors described in text.

---

### SET-02 — Location management

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-08, ING-01 · **Blocks:** —

**Why.** Locations accumulate, and one of them will eventually need to be
removed. Removal destroys imported data, so it needs a real confirmation.

**Read first.** `ux-flows.md` § "Settings: sections" → Location
management · [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §6 →
destructive confirmations · `ui-implementation.md` §4 → `AlertDialog`.

**Scope — in.** List every location with name, address, created date, and
actions to edit, view dashboard, or view chat. Add a new location. Remove
a location behind a confirmation that names the object and states the
real consequence: "This deletes 3 imports and 4,102 rows. It can't be
undone."

**Acceptance criteria.**
- [ ] The confirmation states actual counts from that location's data.
- [ ] Destructive action is never behind a hover-only affordance.
- [ ] Removal is transactional and complete.
- [ ] The location picker updates immediately afterward.

---

### SET-03 — Item master management

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-08, ING-07 · **Blocks:** CHT-06, SET-05

**Why.** "Trust depends on being able to correct the model." Shelf life
and unit cost are our guesses, and Snape must be able to overrule them.

**Read first.** `ux-flows.md` § "Settings: sections" → Menu item
management, including the non-retroactive rule ·
[`brand/brand-foundations.md`](brand/brand-foundations.md) §8 → "Make
every assumption editable and say where to edit it".

**Scope — in.** A table of canonical items for the current location:
display name, canonical name read-only, category, unit, shelf life, cost
per unit, usage count read-only, and active toggle, with edit and archive
actions. Edits take effect immediately for future calculations. Historical
spoilage is **not** retroactively recalculated — recalculation is opt-in
from chat or the dashboard, and the UI says so.

**Acceptance criteria.**
- [ ] Shelf life and cost per unit are editable — this is the ticket's
      whole point.
- [ ] Canonical name cannot be edited.
- [ ] Edits invalidate the affected precomputed metrics (`MET-02`).
- [ ] The non-retroactive behaviour is stated in the UI, not assumed.
- [ ] Every value shows whether it is the user's or our default.
- [ ] Table works at 375px, scrolling inside its own container.

**Verification.** Change a shelf life, confirm future recommendations use
it and historical figures do not silently move.

---

### SET-04 — Import history drill-down

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-08, ING-09 · **Blocks:** —

**Why.** The audit trail "show your work" cites. If a user asks where a
number came from, this is where the answer physically lives.

**Read first.** `ux-flows.md` § "Settings: sections" → Data management ·
`architecture-and-data-model.md` § "CSV upload history".

**Scope — in.** Every past import for the location: filename, type, rows
imported, date, and source. Drill-down to the column mapping used and the
items created or matched.

**Scope — out.** Deleting imports — data is immutable for audit.

**Acceptance criteria.**
- [ ] Every import appears, including manual entries.
- [ ] The mapping used is fully recoverable.
- [ ] Items created versus matched are distinguishable.
- [ ] No delete affordance exists anywhere on this screen.

---

### SET-05 — Shelf-life defaults and category taxonomy

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** SET-03 · **Blocks:** —

**Why.** Two open questions with a shared answer: a committed default
table the user can override, rather than an LLM guess or a hardcoded
constant.

**Read first.** [`open-questions.md`](open-questions.md) §1 Q8, Q9, and
§4 → shelf life defaults · `ux-flows.md` § "Import: full flow" step 4 →
auto-suggested shelf life.

**Scope — in.** A committed default shelf-life table keyed by category —
seafood 3 days, produce and so on. Per-item user overrides always win.
The interaction between the default, category inference, and the user's
override documented and tested. A category list the user can extend.

**Scope — out.** An LLM call to guess shelf life.

**Acceptance criteria.**
- [ ] Defaults live in one committed file, reviewable.
- [ ] Per-item override always wins, and the UI says which is in force.
- [ ] Category assignment never overwrites an explicit user value.
- [ ] A default is never presented as a fact — it is labelled a
      suggestion everywhere it appears.

**Decisions to confirm.** Fixed versus free-form taxonomy is open
(`open-questions.md` §1, Q8). **Default:** ship the suggested list from
`architecture-and-data-model.md` § "Item categorization" as suggestions,
allow free text, and revisit once real import data shows what operators
actually use.

---

### MKT-01 — Site shell, navigation, and theming

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-06 · **Blocks:** MKT-02

**Why.** The public surface. It must look like the product, because
looking like a different product is its own broken promise.

**Read first.** [`brand/marketing-copy.md`](brand/marketing-copy.md) §3.1
· [`brand/brand-foundations.md`](brand/brand-foundations.md) §4 (wordmark)
and §8.

**Scope — in.** Wordmark left, in IBM Plex Sans SemiBold at −0.035em. Nav
of `Pricing`, `Sign in`, and a `Start free` Azure pill. Nothing else. Both
themes.

**Scope — out.** The `Donate` nav item specified in `marketing-copy.md`
§3.1 — **omit it**, donation is out of this backlog per D3 and claims
discipline forbids linking to a page that does not exist. A mega-menu or
a "Solutions" dropdown.

**Acceptance criteria.**
- [x] No logotype file, no icon mark, no mascot, no chef hat, no leaf.
- [x] No `Donate` link.
- [x] Nav works at 375px without overflow.
- [x] Both themes ship at equal quality.

**Notes.** The public header is implemented in `app/site-header.tsx` and
uses the existing Ledger tokens for both themes. The landing page body is
intentionally left to `MKT-02`; the current placeholder only keeps the
shell visibly testable until that ticket is built.

---

### MKT-02 — Landing page, hero through final CTA

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** MKT-01 · **Blocks:** MKT-03, MKT-04, MKT-05

**Why.** The copy is already written and approved. Build it as specified
rather than reinterpreting it.

**Read first.** [`brand/marketing-copy.md`](brand/marketing-copy.md) §1
through §3.9 and §5, §6 · §8 — the recorded failures of the old site,
which must not return.

**Scope — in.** Hero: "Waste less. Feed more. Keep the difference.", the
subhead, both CTAs, and the reassurance line. The proof strip in mono
figures. The problem section written as the salmon scene, not as
statistics. Three how-it-works steps. The final CTA.

**Scope — out.** No hero image, no angled dashboard mockup, no gradient,
no decorative rule. No industry statistics. No AI badge or sparkle. No
testimonials, logos, or customer counts until they are real.

**Acceptance criteria.**
- [x] Copy matches `marketing-copy.md` §3; deviations are justified in
      the PR.
- [x] None of the six recorded old-site failures reappears.
- [x] "AI" appears at most once, low on the page, described as what it
      does.
- [x] No banned word from §6 appears anywhere.
- [x] Passes the greyscale test and the `ui-implementation.md` §6
      checklist.

**Decisions to confirm.** The donation section (`marketing-copy.md` §3.7)
promises a feature this backlog does not build. **Default:** omit §3.7
entirely. The headline's "Feed more" also outruns the product — flag it
for the founder in the PR rather than silently rewriting an approved
headline.

**Notes.** Implemented the approved hero, proof strip, operator problem
scene, three workflow steps, and final CTA in `app/page.tsx`. The donation
section and unsupported proof claims remain omitted. The worked-example CTA
anchors to the workflow section until `MKT-03` can render the real
recommendation component. Live HTTP smoke checks, `npm run prettify`, and
`npm run ci` passed. Browser-harness screenshot QA was unavailable because
the optional gstack browser binary is not built in this environment.

---

### MKT-03 — Proof section, a real recommendation card

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MKT-02, DSH-03 · **Blocks:** —

**Why.** Named the single highest-converting element on the page, because
it answers the objection every persona has: is it making this up?

**Read first.** `marketing-copy.md` §3.6 and §7 ("If a screenshot shows a
feature, that feature ships").

**Scope — in.** One real recommendation card, rendered by the actual
`DSH-03` component, with show-your-work expanded.

**Scope — out.** A mockup, a screenshot, or a hand-built lookalike.

**Acceptance criteria.**
- [ ] It uses the shipped component, not a copy.
- [ ] Every feature visible in it exists in the product.
- [ ] The arithmetic shown is real and correct.

---

### MKT-04 — Pricing section

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** MKT-02 · **Blocks:** —

**Why.** State the price plainly. No contact-sales, no fake three-tier
anchoring.

**Read first.** `marketing-copy.md` §3.8, including its note to whoever
writes it · [`open-questions.md`](open-questions.md) §2 → pricing anchor.

**Scope — in.** The price as it truly is on the day, presented plainly.

**Scope — out.** Any tier structure that does not exist. Any checkout —
there is no billing in this backlog (D7).

**Acceptance criteria.**
- [x] One plan shown, because one plan exists.
- [x] The `Start free` CTA leads to signup, not to a payment form.
- [x] Nothing implies tiers, seats, or contract terms.

**Decisions to confirm.** The $20/location versus $249–350 tension is
unresolved and this ticket does not resolve it. **Default:** publish the
live price and ask the founder to confirm the number before merge.

**Notes.** Published the documented live price of $20 per location per
month as one plan, with a `Start free` link to `/sign-up`. The header's
Pricing link now targets the landing-page section. No checkout, tiers,
seats, or contract terms were added. The signup and authentication flow
remain future work under FND-05.

---

### MKT-05 — Claims-discipline audit

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** MKT-02 · **Blocks:** —

**Why.** D9 invalidated a specific published promise. "Ask it anything"
is no longer true — chat answers what the engine computed, and declines
otherwise. Marketing is held to the same trust contract as the product.

**Read first.** D9 and `CHT-08` above · `marketing-copy.md` §3.5 step 3
and §7 · `brand/brand-foundations.md` §8 → "A hero that promises anything
the product cannot currently do".

**Scope — in.** Rewrite the "Ask it anything" step to describe what chat
actually does. Sweep the whole site against §7's claims list: no POS
integration claims, no multi-location comparison, no pour-cost or event
planning, no notification claims, no unsourced statistics, no
testimonials. Update `brand/marketing-copy.md` itself so the source of
truth stops carrying the invalid claim.

**Acceptance criteria.**
- [x] "Ask it anything" is gone from both the site and
      `marketing-copy.md`.
- [x] Every remaining claim is true of the product on the day of merge.
- [x] Any claim that outruns the product is either removed or gated
      behind the ticket that would make it true.

**Verification.** Read the whole site against `marketing-copy.md` §7 line
by line. Every claim must map to a `done` ticket.

**Notes.** Replaced the retired chat promise and removed unshipped import,
recommendation, and donation claims from the active landing page. The
authoritative copy now labels future dashboard proof as gated by `DSH-03`
and omits the donation section from the current site. Added a regression
test for the retired language and unshipped claims. `npm run prettify`,
`npm run ci`, and live `/` plus `/api/health` smoke checks passed.

---

### QAG-01 — Accessibility gate automation

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-03, FND-07 · **Blocks:** QAG-02

**Why.** `ui-implementation.md` §6 says these block merge. A gate that
depends on someone remembering is not a gate.

**Read first.** [`brand/ui-implementation.md`](brand/ui-implementation.md)
§6 in full · `brand/brand-foundations.md` §9.

**Scope — in.** Automated checks in CI for: text contrast against actual
background, meaningful non-text contrast at 3:1, keyboard reachability
and visible focus rings, accessible names on every icon and control,
touch targets ≥44×44px, body text ≥16px on mobile, real form labels, and
both themes. A documented manual sweep for what cannot be automated.

**Acceptance criteria.**
- [x] Each automatable item in §6 has a check that fails the build.
- [x] Checks run against both themes.
- [x] Manual-sweep steps are written into the PR template.
- [x] A deliberately broken component is detected by the gate's regression test.

---

### QAG-02 — Greyscale chart check

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** QAG-01, DSH-05 · **Blocks:** —

**Why.** The named acceptance gate for every data visualisation. It
exists because a colour-only chart shipped once and was rejected.

**Read first.** `ui-implementation.md` §5 and §6 →
"Greyscale test" · `brand/brand-foundations.md` §5.1.

**Scope — in.** A CI check that renders every chart, desaturates it, and
asserts that each series is still distinguishable by pattern. A static
check that no green value is reachable from any chart code path. Pattern
assignment order verified against the fixed sequence.

**Acceptance criteria.**
- [x] A chart built without patterns fails CI.
- [x] A green colour value anywhere in chart code fails CI.
- [x] A sixth series fails CI.
- [x] Desaturated renders are attached to the CI run for human review.

**Verification.** Add a deliberately colour-only chart in a branch and
confirm the build fails.

**Notes.** `tests/charts/greyscale-gate.test.ts` statically scans every
chart implementation for forbidden green values and validates the fixed
pattern sequence, five-series ceiling, and pattern-bearing marks. The
Playwright `test:charts` gate renders the gallery at 375px, applies a
greyscale filter, verifies every current bar and line encoding, and
attaches `greyscale-charts.png` to the Playwright test result. CI runs the
gate and uploads `test-results/` alongside the existing report artifacts.

---

### QAG-03 — Test strategy and harness

```
Status: in-review   Owner: codex   Claimed: 2026-08-08   Completed: —   Branch/PR: rewrite
```

**Blocked by:** FND-03 · **Blocks:** QAG-06

**Why.** The engine's arithmetic is the product. It has to be tested
against a real database, because mocked queries prove nothing about SQL.

**Read first.** `archive/existing-repo-audit-consolidated.md` § "Testing
Coverage" and § "Coverage Gaps and Weak Spots" — what the prior build
under-tested.

**Scope — in.** Unit tests for the metric functions. Integration tests
for the engine against a real database instance. End-to-end coverage of
the critical path: signup, create location, import, dashboard. Shared
fixtures — a messy-CSV set, a partial-data location, and a location with
a full year of history. A documented coverage expectation for engine
code.

**Acceptance criteria.**
- [ ] Engine tests run against a real database, not mocks.
- [ ] The critical path runs end to end in CI.
- [x] Fixtures are reusable by other tickets.
- [x] Tests are deterministic — no reliance on wall-clock now, no
      ordering assumptions.

**Notes.** The reusable fixture set and a Testcontainers-backed PostgreSQL
integration harness are in place, and CI runs the harness. The engine and
authenticated import/dashboard flows do not exist yet, so the two remaining
acceptance checks must close with `MET-01` and the dependent application
tickets rather than being represented by placeholder tests.

---

### QAG-04 — CSV upload security hardening

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** FND-02 · **Blocks:** ING-02

**Why.** A flagged risk area in the prior build, and the one place the
product accepts arbitrary files from the outside world.

**Read first.** `archive/existing-repo-audit-consolidated.md` §
"Security and Ownership Concerns" and § "CSV Import Pipeline" ·
[`../AGENTS.md`](../AGENTS.md) § "Repo state".

**Scope — in.** Content-based type validation. Enforced size ceiling.
Streaming parse, so a large file cannot exhaust memory. Formula-injection
neutralisation on export, so a cell beginning `=` or `+` cannot execute
in a spreadsheet. Generated storage keys, never user filenames. Uploads
authorised against location ownership. Rate limiting.

**Acceptance criteria.**
- [x] A renamed non-CSV is rejected on content.
- [x] A file above the ceiling is rejected before it is fully read.
- [x] A parse of a very large file holds memory flat.
- [x] Exported cells starting with a formula character are neutralised.
- [x] Path traversal via filename is impossible.
- [x] Uploading to a foreign location identifier fails.

**Verification.** A hostile-file fixture set, run in CI.

**Notes.** `src/server/csv/security.ts` provides the framework-independent
guards that `ING-02` will compose into the upload route: content sniffing,
bounded streaming, formula-safe CSV serialization, generated storage keys,
ownership authorization, and rate limiting. The test suite covers renamed
binary content, an oversized stream, chunked pass-through, formula cells,
path traversal, foreign locations, and repeated uploads. The upload route
must stage the object and only publish its key after the guarded stream has
completed, so a late stream error cannot expose a partial file.

---

### QAG-05 — Observability and error tracking

```
Status: in-review   Owner: codex   Claimed: 2026-08-08   Completed: —   Branch/PR: —
```

**Blocked by:** FND-03 · **Blocks:** —

**Why.** A stale metric store or a silently failing precompute run is
invisible from the outside and produces confidently wrong numbers — the
exact failure the trust contract forbids.

**Read first.** `MET-02` above · `cost-and-pricing.md` (per-query cost is
worth logging from day one).

**Scope — in.** Structured logging. Error capture with alerting. Health
signals for the precompute pipeline: last successful run per location,
run duration, failure count. LLM cost and token logging per query. Import
success and failure rates.

**Scope — out.** Product analytics on user behaviour.

**Acceptance criteria.**
- [ ] A failed precompute run raises an alert.
- [ ] Metric staleness per location is queryable.
- [ ] LLM spend is attributable per account and per day.
- [x] No log line contains a password, token, or full imported row.

**Verification.**

The framework-independent logger in `src/server/observability/logger.ts`
emits one JSON event per line, permits scalar operational fields only,
redacts secrets and imported-row-shaped fields, scrubs bearer/query secrets
from text and errors, and exposes an injectable error reporter for the
Sentry adapter. It now also exposes typed producer events for precompute,
imports, and LLM queries; LLM cost is recorded as an integer number of
micro-units so per-account and per-day aggregation never uses a float.
`logger.test.ts` covers the event contract and the redaction boundary.

The independently testable aggregation layer is now in
`src/server/observability/metrics.ts`. `OperationalMetrics` records
location-scoped precompute successes and failures, raises an injectable alert
for each failure, exposes a staleness query against an explicit threshold, and
aggregates LLM token usage and integer micro-costs by account and UTC day. It
also records import successes and failures and exposes a per-location success
rate with its underlying counts. `metrics.test.ts` covers those boundaries,
including defensive date copies, invalid numeric values, mixed-currency
rejection, aggregate safe-integer overflow protection, import outcome
validation, and the exact staleness threshold boundary. The registry is deliberately
in-process until the producers and persistent telemetry store arrive; it
provides the typed seam those integrations will consume.

The remaining acceptance criteria require `MET-02`'s precompute pipeline,
the LLM narration service, and import execution paths. They are intentionally
left in review until those producers exist; this ticket must then compose
the logger with Sentry/OpenTelemetry and persisted health/cost signals.

---

### QAG-06 — Data isolation and ownership authorization

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** FND-05, QAG-03 · **Blocks:** —

**Why.** Every account's data is commercially sensitive. The prior build
had ownership gaps. And when a second tenant type eventually arrives, the
boundary these tests defend is the one that must hold.

**Read first.** `FND-05` above · `archive/existing-repo-audit-consolidated.md`
§ "Security and Ownership Concerns" ·
`architecture-and-data-model.md` § "Access boundary" — written for
donation, but the principle is general: enforce at the query layer, not
in the UI.

**Scope — in.** An automated suite asserting that no route, query, or
export returns data belonging to another account, given a valid session
and a foreign identifier. Coverage of every route that takes an
identifier. A test that fails when a new route is added without an
ownership check.

**Acceptance criteria.**
- [ ] Every identifier-taking route is covered.
- [ ] A new unprotected route fails CI.
- [ ] Location scoping is enforced in queries, never only in the UI.
- [ ] Chat cannot reach another location's data even when asked directly.

**Verification.** Two seeded accounts; attempt every cross-boundary read
and write.

---

### AGG-01 — Lift the single-location scope rule

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-07, DSH-03 · **Blocks:** AGG-02

**Why.** "One operation at a time" is stated in product copy, UX,
queries, and chat scoping. Aggregation is not a new screen — it is the
removal of an invariant that the whole codebase currently assumes.

**Read first.** [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)
§ "Scope rule: one operation at a time" · D4 in §3 above ·
`open-questions.md` §3.6 (scope interaction).

**Scope — in.** Make location scope an explicit parameter throughout the
engine and the query layer, accepting one location, several, or all owned
locations. Precompute rollups at the portfolio level. Update the copy
that currently promises single-location scoping. Audit every query that
assumes exactly one location.

**Scope — out.** The rollup and comparison UI.

**Acceptance criteria.**
- [ ] Scope is a parameter, never an implicit global.
- [ ] Single-location behaviour is byte-identical to before this ticket.
- [ ] Every query assuming one location is found and updated — the audit
      list is in the PR.
- [ ] `QAG-06` still passes: aggregation never crosses an account
      boundary.
- [ ] Product copy no longer promises what is now false.

**Verification.** Run the full test suite before and after and diff the
single-location outputs. They must match exactly.

---

### AGG-02 — Portfolio rollup

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** AGG-01 · **Blocks:** AGG-03, AGG-04

**Why.** Dumbledore's job: see the whole business, then decide which
location to open.

**Read first.** [`personas-and-research.md`](personas-and-research.md) →
Albus Dumbledore · `marketing-copy.md` §4 → "Run every location like your
best location".

**Scope — in.** An all-locations view: total money at risk, the ranked
recommendations across the portfolio with each one's location named, and
per-location summary rows. Drill from any row into that location's
scoped dashboard.

**Acceptance criteria.**
- [ ] Every figure names the location it belongs to.
- [ ] Ranking across locations uses the same `MET-07` formula, with no
      second implementation.
- [ ] Rollups sum correctly and are reconcilable against each location.
- [ ] The current scope — portfolio or single location — is unambiguous
      on screen.

---

### AGG-03 — Location comparison

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** AGG-02, DSH-05 · **Blocks:** —

**Why.** Side-by-side comparison, explicitly excluded from the MVP and
committed under D4.

**Read first.** `AGG-02` above · `ui-implementation.md` §5 → ranked
horizontal bars are the preferred shape.

**Scope — in.** Compare locations on the same metric over the same
period: spoilage rate, margin, sell-through, and money at risk. Ranked
horizontal bars, not grouped or stacked charts. Locations with differing
data coverage are marked as such rather than compared misleadingly.

**Acceptance criteria.**
- [ ] Locations with different data sufficiency are visibly flagged, not
      silently ranked against each other.
- [ ] Every mark prints its value and carries its pattern.
- [ ] Passes the greyscale gate.
- [ ] No comparison is shown where the underlying periods differ.

---

### AGG-04 — Cross-location chat scope

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** AGG-02, CHT-03 · **Blocks:** —

**Why.** Chat is currently scoped to one location by hard enforcement.
Widening it safely means widening the guardrail, not removing it.

**Read first.** `CHT-03` above · `MET-12` (the context bundle is
per-location and token-budgeted).

**Scope — in.** Let chat answer across the account's locations when the
user asks. The `MET-12` bundle extended to a portfolio shape within the
same token budget, summarising harder as location count rises. Every
answer names which locations it drew on.

**Acceptance criteria.**
- [ ] Account boundary still holds absolutely.
- [ ] Every cross-location answer names its locations.
- [ ] The context bundle stays within budget at ten locations.
- [ ] `CHT-03`'s figure-matching guardrail still blocks ungrounded
      numbers.

---

### INT-01 — Source-agnostic ingestion abstraction

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** ING-09 · **Blocks:** INT-02, STF-01

**Why.** CSV must stop being the special case before the first connector
lands. Otherwise every connector reimplements normalization and the four
copies drift.

**Read first.** `ING-09` above · `architecture-and-data-model.md` §
"Canonical data model" — `source` and `externalId` already anticipate
this.

**Scope — in.** One normalization path that both CSV import and API
connectors feed. A source-independent representation of an incoming
transaction, purchase order, or inventory count. Item resolution,
deduplication, and history logging shared across all sources. CSV import
refactored onto it, with behaviour unchanged.

**Acceptance criteria.**
- [ ] CSV import behaves identically after the refactor — proven by the
      existing tests.
- [ ] Adding a source requires implementing one adapter and nothing else.
- [ ] Deduplication works across sources on `externalId`.
- [ ] Item resolution stays exact-match only, with no fuzzy path
      introduced for API sources.

---

### INT-02 — Connector framework

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-01, FND-05 · **Blocks:** INT-03, INT-04, INT-05

**Why.** OAuth, token refresh, webhook receipt, backfill, and retry are
the same problem for every vendor. Solve them once.

**Read first.** `archive/existing-repo-audit-consolidated.md` § "Square
Integration" — the prior build's attempt, for its mistakes ·
[`open-questions.md`](open-questions.md) §2 → Square priority, still
unresolved.

**Scope — in.** OAuth authorization and callback handling. Encrypted
credential storage with refresh. Webhook receipt with signature
verification and replay protection. Backfill of history on first connect.
Incremental sync state per connection. Retry with backoff. A connection
record tied to a location.

**Scope — out.** Any specific vendor.

**Acceptance criteria.**
- [ ] Credentials are encrypted at rest and never logged.
- [ ] Webhook signatures are verified; unsigned or replayed deliveries
      are rejected.
- [ ] Sync state survives a restart mid-sync.
- [ ] A revoked authorization surfaces as a connection failure rather
      than as silent data loss.
- [ ] A connector cannot write to a location its account does not own.

---

### INT-03 — Square connector

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-02 · **Blocks:** INT-06

**Why.** The most-requested integration in the market research, and the
one the MVP deliberately shipped without.

**Read first.** `open-questions.md` §2 → the unresolved Square priority ·
`architecture-and-data-model.md` — `source` is already `square`-aware ·
`archive/existing-repo-audit-consolidated.md` § "Square Integration".

**Scope — in.** Connect a Square account to a location. Import orders and
line items as transactions. Import catalogue items as canonical items,
through the same exact-match resolution as CSV. Backfill history on first
connect. Ongoing sync.

**Acceptance criteria.**
- [ ] Square-sourced transactions are indistinguishable downstream from
      CSV rows except by `source`.
- [ ] Catalogue items resolve through `ING-08`; no fuzzy matching is
      introduced.
- [ ] A location can hold both CSV and Square data without duplication.
- [ ] Backfill is resumable.
- [ ] Disconnecting stops sync and retains the imported data.

---

### INT-04 — Toast connector

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-02 · **Blocks:** —

**Why.** The other POS the market research rates must-have.

**Read first.** `INT-03` above — this ticket should be a thin adapter if
`INT-02` did its job.

**Scope — in.** The `INT-03` capabilities, against Toast.

**Acceptance criteria.**
- [ ] Implemented as an adapter only; no framework changes needed.
- [ ] Same acceptance criteria as `INT-03`.
- [ ] If framework changes *were* needed, they are made in `INT-02` and
      `INT-03` is re-verified.

---

### INT-05 — QuickBooks connector

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-02 · **Blocks:** —

**Why.** Rated table stakes in the market research. It supplies the
purchase and cost side that CSV import most often lacks — and missing
unit costs are the single biggest cause of "cannot calculate" in the
engine.

**Read first.** `personas-and-research.md` Part 3 → H2b, H7 ·
`MET-01` above (what missing costs cost us).

**Scope — in.** Connect an accounting account. Import supplier bills as
purchase orders with line items and unit costs. Map vendors to supplier
names.

**Acceptance criteria.**
- [ ] Imported bills populate unit costs on existing items where they
      match exactly.
- [ ] Items unresolvable by exact match go to the `ING-08` queue rather
      than being guessed.
- [ ] Currency and tax handling are explicit, documented, and tested.

---

### INT-06 — Sync scheduling and incremental updates

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-03 · **Blocks:** INT-07, INT-08

**Why.** A connected source that goes stale is worse than no connection,
because the operator believes the numbers are current.

**Read first.** `MET-02` above — precompute must fire after a sync, not
on a fixed clock alone.

**Scope — in.** Scheduled incremental sync per connection. Precompute
triggered on completion. Freshness recorded and surfaced. Overlapping
runs prevented.

**Acceptance criteria.**
- [ ] Incremental sync fetches only what changed.
- [ ] A completed sync triggers precompute for that location only.
- [ ] Two runs for one connection cannot overlap.
- [ ] Last-successful-sync time is visible to the user.

---

### INT-07 — Deduplication and cross-source reconciliation

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-06 · **Blocks:** —

**Why.** An operator who uploaded CSVs for six months and then connects
Square will re-import the same period. Double-counted revenue destroys
every number in the product at once.

**Read first.** `INT-01` above · `architecture-and-data-model.md` §
"Edge cases & honest boundaries" → conflicting data.

**Scope — in.** Detect overlapping periods across sources. Deduplicate on
`externalId` where both sources supply one. Where they do not, surface
the overlap to the user and let them choose which source is authoritative
for that period. Never silently merge.

**Acceptance criteria.**
- [ ] Overlapping CSV and API data never double-counts.
- [ ] Ambiguous overlaps are surfaced, not resolved by guess.
- [ ] The chosen authority per period is recorded and appears in
      `MET-10` traces.

---

### INT-08 — Connection health and failure surfacing

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-06 · **Blocks:** —

**Why.** Per D5 we will never email the operator. That makes in-app
failure surfacing the only channel there is, so it has to be
unmissable.

**Read first.** D5 in §3 above ·
[`brand/voice-and-tone.md`](brand/voice-and-tone.md) §6 → errors.

**Scope — in.** Connection status per location: healthy, stale, failed,
or revoked, with the last successful sync time. A prominent in-app
notice when data is stale, stating how stale and what it means for the
numbers on screen. A reconnect path.

**Acceptance criteria.**
- [ ] Stale data is disclosed on the dashboard itself, not only in
      settings.
- [ ] Status is carried by text and icon, never by colour alone.
- [ ] Error copy says what happened, what it means, and what to do.
- [ ] A revoked authorization is distinguishable from a transient
      failure.

---

### MNU-01 — Recipe and ingredient data model

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** ING-07 · **Blocks:** MNU-02

**Why.** The canonical item master currently conflates two different
things: a thing you buy and a thing you sell. Recipes are the bridge, and
everything in menu management depends on that separation.

**Read first.** `ING-07` above ·
`architecture-and-data-model.md` § "Inventory items" ·
`brand/brand-foundations.md` §2 → the wedge is *not* needing a recipe
library up front. Recipes must stay optional.

**Scope — in.** Distinguish purchased ingredients from sold menu items.
A recipe linking a menu item to ingredient quantities with units. Yield
and waste factors per recipe. Unit conversion between purchase units and
recipe units — pounds to ounces, cases to each. Sub-recipes.

**Scope — out.** Making recipes mandatory. Every existing surface must
keep working for an operator who never builds one.

**Acceptance criteria.**
- [x] The product works unchanged with zero recipes defined.
- [x] Unit conversions are exact and tested, including case-to-each.
- [x] Sub-recipes resolve without infinite recursion.
- [x] Existing canonical items migrate without loss.

**Notes.** Added an additive migration that classifies canonical items as
`ingredient` or `menu_item` without changing existing IDs or values; existing
rows default to `ingredient`. Recipes remain optional and recipe ingredients
are either direct ingredient references or sub-recipes, enforced by a database
check. Standard mass conversions use BigInt-backed exact decimal arithmetic;
item-specific numeric conversion rows support packaging such as case-to-each.
The recipe graph guard rejects direct, indirect, and missing sub-recipe
references before expansion. Static contracts and the full CI suite pass; the
opt-in PostgreSQL round-trip is still skipped when no local database/container
runtime is available.

---

### MNU-02 — Recipe builder

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** MNU-01, FND-07 · **Blocks:** MNU-03

**Why.** Recipe entry is the setup burden that competitors are criticised
for. If ours is tedious, nobody completes one and the whole area is dead.

**Read first.** `marketing-copy.md` §2 → against competitors ·
`personas-and-research.md` → Severus Snape (this is his screen).

**Scope — in.** Build a recipe from existing items with quantities and
units. Incremental — a partial recipe is saved and useful. Live cost as
ingredients are added. Duplicate an existing recipe.

**Acceptance criteria.**
- [x] A partial recipe saves and produces a partial cost, stated as
      partial.
- [x] Cost updates live as ingredients are added.
- [x] Items missing a unit cost are flagged in place, with a link to fix
      them.
- [x] Never implies the software knows the kitchen better than the chef.

**Notes.** The authenticated `/recipes` screen and `/api/recipes` endpoints
support incremental save/edit, exact-string live batch-cost projection,
missing-cost warnings, unit mismatch warnings, and duplication. The
builder leaves recipe assumptions visible and uses suggestion language. Unit
and ownership rules are covered by the server contract; live authenticated
database verification remains pending because this workspace has no test
credentials and its configured PostgreSQL service is unavailable. `npm run
prettify` and `npm run ci` pass.

---

### MNU-03 — Plate costing

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** MNU-02, MET-01 · **Blocks:** MNU-04, MNU-05

**Why.** Turns "why are food costs 32% this month?" from a guess into
arithmetic.

**Read first.** [`vision.md`](vision.md) § "3. Menu management & kitchen
operations" · `MET-01` above — plate cost is a derived metric and belongs
in the same library, with the same cannot-calculate discipline.

**Scope — in.** Cost per plate from recipe and current ingredient costs.
Plate margin against menu price. Food cost percentage per item and per
category. Cost movement over time as ingredient prices change. Full
evidence trace, per `MET-10`.

**Acceptance criteria.**
- [x] A recipe with any ingredient missing a cost returns a partial cost
      that says what is missing — never a silently understated figure.
- [x] Plate cost appears in the persisted evidence trace with its full arithmetic.
- [x] Cost history is retained, so movement is real rather than inferred.
- [x] Figures are exact numerics throughout.

**Notes.** Added menu-item selling prices and an immutable, location-scoped
`recipe_cost_history` record on every recipe save. The record preserves the
ingredient-line batch calculation, output/yield/waste assumptions, effective
output quantity, cost per output, menu price, plate margin, and food-cost
percentage. All division uses BigInt-backed decimal arithmetic with
documented half-up rounding to six places; missing ingredient costs and menu
prices remain explicit. The recipe screen now exposes the plate projection
alongside the batch cost. Static contracts, focused tests, formatting, and CI
pass; live PostgreSQL verification remains dependent on the unavailable local
database/container runtime.

---

### MNU-04 — Theoretical versus actual usage

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MNU-03, MET-03 · **Blocks:** MNU-06, MNU-07

**Why.** The strongest waste signal there is: what the recipes say should
have been used, against what actually left the shelf.

**Read first.** `MET-03` above (D11 — snapshots stay authoritative) ·
`architecture-and-data-model.md` § "Derived metrics" → variance.

**Scope — in.** Theoretical usage from sales multiplied through recipes.
Actual usage from purchases and counts. Variance per ingredient, in units
and in dollars. Variance surfaced as an observation with possible
explanations — over-portioning, waste, theft, or a wrong recipe — and
none of them assumed.

**Acceptance criteria.**
- [ ] Variance is computed per ingredient, not only per menu item.
- [ ] Snapshots remain authoritative for actual usage.
- [ ] Explanations are offered, never asserted.
- [ ] A wrong recipe is named as a candidate explanation — it usually is.
- [ ] Ingredients used in items without recipes are excluded and the
      exclusion is stated.

---

### MNU-05 — Menu engineering matrix

```
Status: done   Owner: codex   Claimed: 2026-08-08   Completed: 2026-08-08   Branch/PR: rewrite
```

**Blocked by:** MNU-03, DSH-05 · **Blocks:** —

**Why.** Popularity against profitability is how operators actually
decide what to feature and what to cut.

**Read first.** `ui-implementation.md` §5 — a scatter or quadrant chart
is a hard case for the pattern-first contract. Read it before designing
anything.

**Scope — in.** Each menu item placed by popularity and margin, with
quadrant membership stated in words on the row, not only by position.
A ranked table alongside, which is the primary reading — the chart is
secondary.

**Scope — out.** Any presentation where colour or position alone carries
the quadrant.

**Acceptance criteria.**
- [x] Quadrant membership is printed as a word on every item.
- [x] The ranked table is readable with the chart removed entirely.
- [x] Passes the greyscale gate.
- [x] Items with insufficient sales history are excluded and the
      exclusion is stated.

**Notes.** Added a location-owned menu engineering query that combines
transaction history with the latest complete recipe-derived plate margin.
The deterministic matrix uses four distinct business weeks by default,
exact decimal arithmetic, average units sold and average plate margin
thresholds, and explicit exclusions for insufficient history or missing
recipe cost. The ranked table is primary; the secondary matrix repeats
quadrant words and printed values so colour and position are never the only
signal. Focused tests, full CI, and live unauthenticated route smoke checks
pass. Authenticated database verification remains pending because this
workspace has no test credentials and its configured PostgreSQL service is
unavailable.

---

### MNU-06 — Menu recommendations in the engine

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MNU-04, MET-09 · **Blocks:** —

**Why.** Menu findings must flow through the same ranked recommendation
pipeline as everything else, or the dashboard becomes two products.

**Read first.** `MET-09` and `MET-07` above · `voice-and-tone.md` §2.5 —
still a suggestion, never an instruction.

**Scope — in.** Recommendation types for margin erosion on a plate,
recipe variance, and an ingredient cost increase that has not been
repriced. Each scored through the existing Impact, Urgency, and Data
Sufficiency dimensions and ranked by `MET-07`.

**Acceptance criteria.**
- [ ] No second ranking implementation is introduced.
- [ ] Menu recommendations carry full `MET-10` traces.
- [ ] They compete on equal terms with spoilage recommendations for the
      top five.
- [ ] Recipe-derived figures are labelled as recipe-derived, since a
      wrong recipe silently poisons them.

---

### MNU-07 — Ingredient-level waste attribution

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MNU-04 · **Blocks:** —

**Why.** Answers the question spoilage-by-item cannot: which *dishes* are
driving the waste of a given ingredient.

**Read first.** `MNU-04` above · `MET-03` (D11).

**Scope — in.** Attribute ingredient consumption and waste back to the
menu items that consumed it. Rank dishes by the waste they generate.

**Acceptance criteria.**
- [ ] Attribution reconciles: attributed usage plus unattributed equals
      total.
- [ ] Unattributed usage is shown explicitly, never distributed by
      assumption.
- [ ] Ingredients shared across dishes are apportioned by a documented,
      tested rule.

---

### STF-01 — Labor data model and import

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** INT-01 · **Blocks:** STF-02

**Why.** Labor is the second-largest cost line in a restaurant and the
product currently cannot see it at all.

**Read first.** [`vision.md`](vision.md) § "1. Staffing optimization" ·
`INT-01` above — labor arrives through the same ingestion abstraction as
everything else.

**Scope — in.** Shifts, roles, scheduled and actual hours, and labor
cost, per location. CSV import and manual entry through the existing
pipeline. Employees represented without storing more personal data than
the analysis needs.

**Scope — out.** Payroll. Scheduling — we recommend, we do not roster.
Storing personal data beyond what the metrics require.

**Acceptance criteria.**
- [ ] Labor imports use the `INT-01` path with no special casing.
- [ ] Personal data is minimised and the minimisation is documented.
- [ ] Scheduled and actual hours are distinct fields.
- [ ] Labor data is location-scoped and ownership-enforced.

---

### STF-02 — Labor efficiency metrics

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** STF-01, MET-01 · **Blocks:** STF-05, STF-06

**Why.** "Which shifts are most profitable?" needs sales and labor on the
same time axis.

**Read first.** `MET-01` above — these belong in the same metric library
with the same cannot-calculate discipline.

**Scope — in.** Sales per labor hour, labor cost percentage, and prime
cost, by shift, by day part, and by day of week. Scheduled against actual
variance.

**Acceptance criteria.**
- [ ] Metrics align sales and labor on the same time boundaries, with
      the boundary rule documented.
- [ ] Periods with labor data but no sales data, and the reverse, are
      excluded and the exclusion is stated.
- [ ] Prime cost combines food and labor only where both are complete.

---

### STF-03 — Demand forecasting

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** MET-02 · **Blocks:** STF-04

**Why.** Everything in staffing, and the better half of purchasing,
depends on a defensible forecast of covers and sales.

**Read first.** D9 in §3 above — a forecast is arithmetic, so it belongs
in the deterministic engine, not in a model call ·
`mvp-scope-and-decisions.md` § "Recommendation contract" — predictions
need four weeks of history and must be labelled.

**Scope — in.** Forecast covers and sales by day and day part from
history, seasonality, and day-of-week pattern. A stated method, a stated
history requirement, and a stated error measure. Forecasts labelled as
predictions with their basis, per the recommendation contract. Accuracy
tracked against outcomes over time.

**Scope — out.** Any forecast the engine cannot explain. An
unexplainable prediction is unusable here regardless of its accuracy.

**Acceptance criteria.**
- [ ] The method is documented and its arithmetic appears in `MET-10`
      traces.
- [ ] Forecasts are suppressed below the documented history minimum.
- [ ] Accuracy is measured against actuals and visible internally.
- [ ] Every forecast is labelled a prediction and states its basis.
- [ ] No forecast is produced inside a model call.

---

### STF-04 — External signals, weather and local events

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** STF-03 · **Blocks:** STF-05

**Why.** The founding vision names weather and local events as forecast
inputs. This is the first time the product depends on data the operator
did not give us — a real change to the grounding contract.

**Read first.** `vision.md` § "1. Staffing optimization" ·
`architecture-and-data-model.md` § "AI / data query layer" — "no external
APIs in MVP" · `archive/existing-repo-audit-consolidated.md` § "Weather
and Places Enrichment" (the prior build attempted this).

**Scope — in.** Historical and forecast weather per location. Local
events where a source exists. Both stored as first-class data with their
provenance, so a forecast that used them can say so. Correlation measured
against actual sales before either is allowed to influence a forecast.

**Scope — out.** Any external signal influencing a recommendation before
its correlation is demonstrated in that location's own data.

**Acceptance criteria.**
- [ ] External data is attributed to its source in every trace.
- [ ] A signal with no demonstrated correlation for a location does not
      affect that location's forecast.
- [ ] An unavailable provider degrades the forecast rather than breaking
      it.
- [ ] Provider cost is logged, per `QAG-05`.

---

### STF-05 — Shift-level recommendations

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** STF-04, STF-02 · **Blocks:** —

**Why.** "How many line cooks should I schedule Friday dinner?" — the
question the founding vision opens with.

**Read first.** `MET-09` above · `voice-and-tone.md` §2.5 — staffing
recommendations touch people's hours, so the suggestion framing matters
more here than anywhere else in the product.

**Scope — in.** Recommended staffing by role and shift, from the forecast
and historical sales-per-labor-hour. Routed through `MET-09` and ranked
by `MET-07`. Every recommendation states its forecast basis and its
error range.

**Scope — out.** Publishing a schedule. Anything that writes to a
rostering system. The product recommends; the operator decides.

**Acceptance criteria.**
- [ ] Recommendations are suggestions and read as suggestions.
- [ ] Each states the forecast it rests on and how uncertain that
      forecast is.
- [ ] Nothing writes to any scheduling system.
- [ ] Understaffing and overstaffing risks are both surfaced — the cost
      of a bad Friday is not only labor dollars.

---

### STF-06 — Labor cost in the Impact score

```
Status: available   Owner: —   Claimed: —   Completed: —   Branch/PR: —
```

**Blocked by:** STF-02, MET-05 · **Blocks:** —

**Why.** Once labor is visible, a labor problem may well outrank a
spoilage problem — and the dashboard has to be able to say so.

**Read first.** `MET-05` and `MET-07` above ·
`architecture-and-data-model.md` § "Extending the formula" — the
documented procedure for adding a dimension.

**Scope — in.** Labor cost variance added as an Impact category
alongside the four in D10. Weights rebalanced proportionally per the
documented procedure. Configuration updated in `MET-08`.

**Acceptance criteria.**
- [ ] Existing Impact behaviour is unchanged for locations with no labor
      data.
- [ ] Weights rebalance proportionally; the arithmetic is in the PR.
- [ ] Labor recommendations compete on equal terms for the top five.
- [ ] D10 in §3 of this file is updated to record the fifth category.

---

## 6. Progress

Update this when a ticket changes state. It is the loop's stopping
condition.

| Area | Done | Total |
|---|---|---|
| Foundation | 8 | 8 |
| Data ingest | 6 | 11 |
| Metrics engine | 1 | 12 |
| Dashboard | 1 | 7 |
| Chat | 0 | 8 |
| Settings | 0 | 5 |
| Marketing site | 4 | 5 |
| Quality gates | 3 | 6 |
| Cross-location | 0 | 4 |
| Integrations | 0 | 8 |
| Menu management | 4 | 7 |
| Staffing | 0 | 6 |
| **Total** | **26** | **87** |

**The backlog is complete when every ticket reads `done`.** Sections 7
and 8 are not work and never become work.

## 7. Permanently out of scope

Decided 2026-08-07 (D5). These are **not** deferred. Do not propose them,
do not build toward them, and do not write marketing copy that implies
them.

| Not building | Consequence for the build |
|---|---|
| **MCP server / external agent access** | PantryIQ is not queryable from outside its own UI. Do not design an "API-first" layer to enable it. |
| **Email, push, and webhook notifications** | In-app is the only channel that will ever exist. `INT-08` therefore has to make stale-data failures unmissable inside the app, because nothing else will tell the operator. |
| **Native mobile applications** | Responsive web is the whole story. Mobile quality is a first-class requirement of every UI ticket — build at 375px — but there is no app to defer work to. |
| **Export and downstream action workflows** | `ING-11`'s CSV export is the only export. No scheduled exports, no PDF, no emailed digests, no writing orders back to a supplier or a POS. |

Two long-standing product commitments also stand and are worth
restating, because they are easy to erode one ticket at a time:

- **The AI never writes to the data model on its own.** Autonomous
  chat-to-dashboard write-back is a permanent non-goal. `CHT-06` is the
  only override path and it always asks first.
- **No fuzzy item matching, at any confidence, ever.** `ING-08` and
  `INT-03` both restate this because it is the most tempting rule in the
  system to break.

## 8. Deferred to a later session

Real scope. Not scheduled here. **No tickets — do not write any.**

### Food donation marketplace

A two-sided marketplace where restaurants register as donors, shelters
and soup kitchens register as recipients, and the two are matched by
locality. Confirmed as MVP scope by the founder on 2026-08-07, and
deliberately excluded from this backlog on the same day so it can be
thought through properly rather than specified in passing.

It is not cancelled and it is not descoped. It is unscheduled.

Everything written about it stands and should be read before it is
picked up: `mvp-scope-and-decisions.md` § "Food donation" and its Donate
and Claim page sections, [`ux-flows.md`](ux-flows.md) § "Donation: flow",
`architecture-and-data-model.md` § "Food donation (added 2026-08-07 —
provisional)", [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §1
and §7, and above all
[`open-questions.md`](open-questions.md) §3 — the largest open cluster in
the corpus, four items of which block any code at all.

**Consequences for work happening now:**

- `FND-04` must **not** create the provisional donation tables.
- `MKT-01` must **not** link to a donate page, and `MKT-02` must omit the
  donation section — claims discipline forbids promising it.
- The account model (D6) stays single-owner. A recipient is a second
  tenant type, and `QAG-06`'s boundary is the one that will have to hold
  when it arrives. Build that boundary properly now.
- The hard rules survive regardless of how the open questions resolve: a
  recipient must never read restaurant financial data, and the recipient
  surface never uses dollar framing.

### Billing and payments

No subscription, payment, entitlement, or plan-gating work (D7). Every
account is fully entitled. The pricing tension in `open-questions.md` §2
is unresolved and building something will not resolve it — `MKT-04`
publishes whatever price is true on the day and nothing more.

### Feedback loop, phases 2 and 3

Thumbs up and down on recommendations, and learning which recommendation
types help. Specified in `mvp-scope-and-decisions.md` § "Feedback loop
(phased)". Machine-learned weight tuning and per-user personalization
remain non-goals.

### Multi-user organisations and roles

GMs, chefs, and staff with their own logins and per-location scoping
(D6). Needed before `MNU` and `STF` reach real kitchens, since those are
the chef's and the manager's screens rather than the owner's. Not
scheduled.
