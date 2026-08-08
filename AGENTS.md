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

The active work is planning, not code. The docs form a single corpus with
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

Explicit MVP non-goals worth knowing before proposing scope: POS
integrations (Square/Toast), cross-location comparison, email/push/webhook
notifications, pour-cost workflows, event-specific planning, export/handoff
workflows beyond CSV, and any autonomous chat-to-database write-back.
