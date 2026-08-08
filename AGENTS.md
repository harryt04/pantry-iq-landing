## Repo state

This branch (`rewrite`) is **docs-only**. There is no application code yet —
`master` was reset to a clean planning corpus (see commit `e15ed36`, "restart
with docs only") ahead of a rewrite. The `node_modules/` directory present
locally is leftover from before the reset; there is no `package.json` at the
repo root.

The prior implementation (before the reset) was a Next.js 16 / React 19 /
TypeScript 5 (strict) / PostgreSQL 18 + Drizzle ORM monolith. A consolidated
technical audit of that codebase is kept at
[`docs/archive/existing-repo-audit-consolidated.md`](docs/archive/existing-repo-audit-consolidated.md)
for reference — read it before making decisions about CSV upload security,
file storage, or schema design, since those were flagged risk areas in the
prior build. It is not binding on the rewrite.

## Working in this repo right now

**If you are here to build, go to
[`docs/feature-backlog.md`](docs/feature-backlog.md).** It holds 87
tickets, ordered only by dependency, each one claimable. Read its
Decision Record first — it closes several questions the planning corpus
leaves open.

Then read **[`docs/tech-stack.md`](docs/tech-stack.md)** before writing a
line of code. It is authoritative for every technology choice, approved
2026-08-07. Three of its rules get broken by default if you don't know
them: **money never touches a float** (§3.9), **a restaurant's business
day is not a calendar day** (§3.10), and **email is authentication
plumbing, never a notification channel** (§3.14). The pre-reset stack
described below is reference, not a source of authority — the choices
overlap, the reasoning is independent.

The rest of the active work is planning. The docs form a single corpus with
each file owning one category — **do not create new planning files**; put
new content in the doc that already owns that category (see the ownership
table in [`docs/INDEX.md`](docs/INDEX.md)). This corpus was itself
consolidated from 18 overlapping docs from earlier sessions specifically to
stop that sprawl.

Read [`docs/INDEX.md`](docs/INDEX.md) first — it gives the reading order and
an ownership table. In short:

| Document                                                                     | Owns                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`docs/vision.md`](docs/vision.md)                                           | Founding narrative, long-term roadmap, business model principles                                                     |
| [`docs/personas-and-research.md`](docs/personas-and-research.md)             | User personas, customer discovery tooling, market/competitive research                                               |
| [`docs/mvp-scope-and-decisions.md`](docs/mvp-scope-and-decisions.md)         | **Authoritative.** What's in/out of MVP scope, product contract, recommendation contract, workflows                  |
| [`docs/ux-flows.md`](docs/ux-flows.md)                                       | Step-by-step page mechanics (import, chat, settings)                                                                 |
| [`docs/architecture-and-data-model.md`](docs/architecture-and-data-model.md) | Data model schema, recommendation engine implementation detail                                                       |
| [`docs/cost-and-pricing.md`](docs/cost-and-pricing.md)                       | LLM cost analysis, market pricing research                                                                           |
| [`docs/open-questions.md`](docs/open-questions.md)                           | Everything unresolved or contradictory across the above — check before deciding anything that touches a flagged area |
| [`docs/brand/`](docs/brand/)                                                 | **Brand and design.** Four documents — identity/colour/type, voice, marketing copy, and UI implementation. See below                                    |
| [`docs/tech-stack.md`](docs/tech-stack.md)                                   | **Technology choices and why.** Language, framework, database, jobs, auth, LLM access, hosting, and what we refuse to use                               |
| [`docs/feature-backlog.md`](docs/feature-backlog.md)                         | **Execution state.** Tickets, dependency order, claim status, and the decisions closed on 2026-08-07. Owns what gets built; owns no product truth       |

Where docs disagree, [`mvp-scope-and-decisions.md`](docs/mvp-scope-and-decisions.md)
wins; it was built by reconciling the others (see its "Provenance &
corrections" section for what it overrode and why).

## Product summary (for context when writing or reviewing docs)

PantryIQ is decision-support for restaurant operators managing sales,
purchasing, and waste — not an autopilot. Core loop: **CSV import →
operational facts → ranked recommendation → dashboard explanation → chat
investigation.** MVP is scoped to one location/operating unit at a time (no
cross-location aggregation). Two co-equal first-value paths: a dashboard
(passive monitoring) and chat (active investigation), both grounded only in
imported data.

Trust is the central adoption gate: recommendations must separate observed
facts from predictions, state what can't be calculated, and never claim
certainty they don't have. Predictions require a minimum of four weeks of
transaction history. Ranking formula: `Impact × 0.40 + Urgency × 0.40 + Data
Sufficiency × 0.20` (see
[`mvp-scope-and-decisions.md`](docs/mvp-scope-and-decisions.md#scoring-formula)
for the full contract and message format).

## Before you touch any UI, copy, or colour

Read [`docs/brand/brand-foundations.md`](docs/brand/brand-foundations.md)
first, then whichever sibling covers your task:
[`voice-and-tone.md`](docs/brand/voice-and-tone.md) for anything users
read, [`marketing-copy.md`](docs/brand/marketing-copy.md) for the landing
page and positioning,
[`ui-implementation.md`](docs/brand/ui-implementation.md) for tokens,
components, and charts.

Three rules that get violated by default if you don't know them:

1. **Colour is never load-bearing.** The product owner has red-green
   colour vision deficiency. Never encode state in colour alone, never
   distinguish two states by two shades of one hue, and never by two hues
   of the same temperature. Every chart carries a pattern and a printed
   value. **The greyscale test is a merge gate:** desaturate a screenshot
   and read it. No green anywhere in the product.
2. **We use shadcn/ui for Radix behaviour, not for its appearance.**
   Stock shadcn styling is off-brand. Round controls (`999px`) on square
   paper (`3px`), figures in IBM Plex Mono, warm neutrals rather than
   cool greys.
3. **Never promise what the MVP can't do.** Marketing claims are held to
   the same trust contract as product output.

## Scope note: food donation

A two-sided donation marketplace — restaurants registering as donors,
shelters and soup kitchens as recipients, matched by locality — is **MVP
scope**, confirmed by the founder on 2026-08-07. The corpus was reconciled
the same day: see "Food donation" in
[`docs/mvp-scope-and-decisions.md`](docs/mvp-scope-and-decisions.md), the
flow in [`docs/ux-flows.md`](docs/ux-flows.md), and the provisional tables
in [`docs/architecture-and-data-model.md`](docs/architecture-and-data-model.md).

**In scope does not mean scheduled.** Donation is deliberately excluded
from [`docs/feature-backlog.md`](docs/feature-backlog.md) — see its §8.
Do not write donation tickets, do not create the provisional donation
tables, and do not link a donate page from the marketing site.

**In scope does not mean specified, either.**
[`docs/open-questions.md`](docs/open-questions.md) §3 is the largest open
cluster in the corpus, and four of its items block implementation: food
safety liability, recipient notification (which contradicts the
notifications non-goal), recipient verification, and the account model —
recipients are a second user type the current schema cannot express. Read
that section before building any of this.

Two hard rules that hold regardless of how those resolve: **a recipient
must never see restaurant financial data**, and **the recipient surface
never uses dollar framing.**

Explicit MVP non-goals worth knowing before proposing scope: POS
integrations (Square/Toast), cross-location comparison, email/push/webhook
notifications, pour-cost workflows, event-specific planning, export/handoff
workflows beyond CSV, and any autonomous chat-to-database write-back.
