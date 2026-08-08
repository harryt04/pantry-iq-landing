# PantryIQ Docs — Index

Planning documentation for the MVP rewrite. This corpus was consolidated
from 18 overlapping planning documents produced in earlier sessions — see
each file's provenance notes for where its content came from.

## Reading order

If you're starting fresh, read in this order:

1. **[`vision.md`](vision.md)** — founding narrative and long-term product
   vision. Context, not MVP scope.
2. **[`personas-and-research.md`](personas-and-research.md)** — who
   PantryIQ is for (10 personas) and what customer/market research says
   about them. Long — read the persona you care about, skim the rest.
3. **[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md)** — **the
   authoritative document.** What the MVP actually is: product contract,
   scope, recommendation logic, page-level feature list, non-goals,
   roadmap. Start here if you only read one file.
4. **[`ux-flows.md`](ux-flows.md)** — step-by-step UX mechanics (import
   flow, chat interaction model, settings) underneath the scope decisions
   above.
5. **[`architecture-and-data-model.md`](architecture-and-data-model.md)**
   — canonical data model (tables, fields) and the recommendation engine
   implementation detail (scoring formulas, edge cases, tuning config).
6. **[`cost-and-pricing.md`](cost-and-pricing.md)** — LLM cost/margin
   analysis and market pricing research. These two don't agree yet — see
   the mismatch section at the bottom.
7. **[`open-questions.md`](open-questions.md)** — everything not yet
   decided: the missing CPO questions, the Square-priority tension, the
   pricing tension, and narrower technical unknowns. Read before making
   any decision that touches these areas, so you don't silently
   contradict something already flagged.

## Reference material (not actively maintained as MVP scope)

- **[`archive/existing-repo-audit-consolidated.md`](archive/existing-repo-audit-consolidated.md)**
  — technical audit of the pre-rewrite codebase (the implementation that
  used to live on `master` before this branch reset to docs-only). Kept
  for reference; not folded into the docs above. Worth reading before
  making decisions about CSV upload security, file storage, or schema
  design, since those were flagged risk areas in the prior build.

## How this corpus is organized

Each of the 7 core documents owns one category of information and is the
single place to look for it:

| Document | Owns |
|---|---|
| `vision.md` | Founding narrative, long-term roadmap, business model principles |
| `personas-and-research.md` | User personas, customer discovery tooling, market/competitive research |
| `mvp-scope-and-decisions.md` | What's in and out of MVP scope, product contract, recommendation contract, workflows |
| `ux-flows.md` | Step-by-step page mechanics (import, chat, settings) |
| `architecture-and-data-model.md` | Data model schema, recommendation engine implementation detail |
| `cost-and-pricing.md` | LLM cost analysis, market pricing research |
| `open-questions.md` | Everything unresolved or contradictory across the above |

If you're about to add new planning content, put it in the document that
owns its category rather than creating a new file — that's what caused
the sprawl this consolidation cleaned up.
