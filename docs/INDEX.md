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
8. **[`tech-stack.md`](tech-stack.md)** — what we build with and why.
   Approved 2026-08-07. Read before writing any code; §3.9 (money),
   §3.10 (the restaurant business day), and §3.14 (email is not a
   notification channel) impose rules that are easy to violate by
   accident.
9. **[`feature-backlog.md`](feature-backlog.md)** — **the execution
   surface.** 87 tickets, ordered only by dependency, each claimable and
   checkable off. If you are here to build rather than to plan, go
   straight there — but read its Decision Record first, which closes
   several questions the six documents above leave open.

## Brand & design

Brand is a category that did not exist when this corpus was consolidated.
It lives in [`brand/`](brand/) rather than inside any of the seven
documents above, and follows the same one-file-owns-one-category rule.

Read [`brand/brand-foundations.md`](brand/brand-foundations.md) first —
the other three extend it and must not contradict it.

| Document | Owns |
|---|---|
| [`brand/brand-foundations.md`](brand/brand-foundations.md) | **Root brand doc.** Positioning, personality, naming, colour palette, typography, design language, brand do's and don'ts, accessibility commitments |
| [`brand/voice-and-tone.md`](brand/voice-and-tone.md) | How PantryIQ talks — chat responses, UI microcopy, errors, handling disagreement, banned language, the two-audience voice split |
| [`brand/marketing-copy.md`](brand/marketing-copy.md) | Headline and positioning statements, landing page structure and copy, per-persona messaging, claims discipline |
| [`brand/ui-implementation.md`](brand/ui-implementation.md) | Design tokens, shadcn/ui component assignments, the pattern-first chart contract, accessibility gates, layout and motion rules |

**Two things in there that constrain product decisions, not just visual
ones:**

1. **Colour is never load-bearing.** The product owner has red-green
   colour vision deficiency, and so do roughly 1 in 12 male operators.
   Every chart must survive being desaturated. This is a merge gate, not
   a preference.
2. **The donation marketplace is real MVP scope** — restaurants and
   shelters both registering, matched by locality. The product corpus was
   reconciled to this on 2026-08-07. It is in scope but **not specified**:
   [`open-questions.md`](open-questions.md) §3 is now the largest open
   cluster in the corpus and four of its items block implementation.
   It is also **not scheduled** — the founder deliberately kept it out of
   [`feature-backlog.md`](feature-backlog.md) on the same day, to think it
   through rather than specify it in passing. See that file's §8.

## Reference material (not actively maintained as MVP scope)

- **[`archive/existing-repo-audit-consolidated.md`](archive/existing-repo-audit-consolidated.md)**
  — technical audit of the pre-rewrite codebase (the implementation that
  used to live on `master` before this branch reset to docs-only). Kept
  for reference; not folded into the docs above. Worth reading before
  making decisions about CSV upload security, file storage, or schema
  design, since those were flagged risk areas in the prior build.

## How this corpus is organized

Each of the 9 core documents owns one category of information and is the
single place to look for it:

| Document | Owns |
|---|---|
| `vision.md` | Founding narrative, long-term roadmap, business model principles |
| `tech-stack.md` | **Technology choices and their reasoning.** Language, framework, database, jobs, auth, LLM access, hosting, and what we deliberately refuse |
| `feature-backlog.md` | **Execution state.** Tickets, dependencies, claim status, and the decisions closed on 2026-08-07. Owns what gets built; owns no product truth |
| `personas-and-research.md` | User personas, customer discovery tooling, market/competitive research |
| `mvp-scope-and-decisions.md` | What's in and out of MVP scope, product contract, recommendation contract, workflows |
| `ux-flows.md` | Step-by-step page mechanics (import, chat, settings) |
| `architecture-and-data-model.md` | Data model schema, recommendation engine implementation detail |
| `cost-and-pricing.md` | LLM cost analysis, market pricing research |
| `open-questions.md` | Everything unresolved or contradictory across the above |
| `brand/brand-foundations.md` | Brand identity, colour, typography, design language |
| `brand/voice-and-tone.md` | Product and AI voice, microcopy |
| `brand/marketing-copy.md` | Positioning, landing page, persona messaging |
| `brand/ui-implementation.md` | Design tokens, shadcn usage, chart rules, a11y gates |

If you're about to add new planning content, put it in the document that
owns its category rather than creating a new file — that's what caused
the sprawl this consolidation cleaned up.
