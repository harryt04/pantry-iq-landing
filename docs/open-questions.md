# PantryIQ — Open Questions

Everything here is unresolved by design. Consolidation reorganized and
de-duplicated the planning corpus — it did not adjudicate these. Each
entry cites which source docs disagree or leave a gap, so a future
planning session can decide with full context instead of re-discovering
the conflict.

## 1. The CPO-QUESTIONS.md gap

`docs/mvp-ux-planning/CPO-QUESTIONS.md` was referenced everywhere in the
planning corpus (`INDEX.md`, `SESSION-1-SUMMARY.md`,
`GRILLING-SESSION-NOTES.md`, `QUICK-REFERENCE.md`,
`RECOMMENDATION-ENGINE-ARCHITECTURE.md`, `PRD-SKELETON.md`) as containing
**15 detailed questions (Q1–Q15)** awaiting CPO review. The file itself
only ever contained **one question (Q1)**. The other 14 were apparently
never written down, even though later documents cite them by number as if
they existed.

The only real question that survives from that file:

> **Q1 — Impact calculation scope.** Which cost categories belong in the
> Impact score for ranking dashboard alerts: current spoilage risk
> (on-hand inventory × unit cost), historical spoilage (past weeks' waste
> × unit cost), overordering cost (excess inventory carrying cost), and/or
> margin loss (low-selling items' margin impact)? Should these be
> weighted equally or should spoilage dominate? Should the weights be
> user-tunable per business, or standardized industry-wide?

The remaining 14 were never written, but their *topics* are recoverable
from cross-references in `GRILLING-SESSION-NOTES.md` and
`PRD-SKELETON.md`. Reconstructed from those references (grouped, not
verbatim — the original wording doesn't exist):

- **Q2–Q3** — exact calculation methods for the Urgency and Data
  Sufficiency (formerly "Confidence") scores, parallel to Q1's treatment
  of Impact.
- **Q4** — minimum alert thresholds: should dashboard alerts require a
  minimum score per dimension, or always just show the top 3–5 regardless
  of absolute score?
- **Q5** — partial data handling policy: precise rules for what to show
  (and what to withhold) when prices, inventory counts, or history length
  are incomplete.
- **Q6** — waste vs. variance: which formula is authoritative when
  spoilage can be computed two ways (PO + transaction math vs. inventory
  snapshots), and how to handle disagreement between them.
- **Q7** — recommendation tone and framing preferences.
- **Q8** — item category taxonomy: fixed list or free-form user-defined categories?
- **Q9** — conditional/override shelf life handling — how defaults, category-level inference, and per-item user overrides interact.
- **Q10** — minimum required purchase-order structure for import.
- **Q11** — how to handle partial PO imports (missing fields, partial line items).
- **Q12–Q14** — chat scope boundaries, exact explainability depth ("show your work" detail level), and override-workflow mechanics (e.g. does a mid-conversation override cascade to the dashboard immediately or only after confirmation?).
- **Q15** — quantitative success metrics: beta user count target, conversations per user per week, dashboard engagement rate, recommendation adoption rate, NPS target, time-to-first-value target. (`PRD-SKELETON.md` leaves all of these as literal `?` placeholders.)

**Decision needed:** either reconstruct and answer all 15 properly with
current CPO/product input, or explicitly drop the "15 questions" framing
and re-scope what's actually still open (this document is an attempt at
the latter).

## 2. Product scope tensions

### Square / POS integration priority

- **`mvp-scope-and-decisions.md`** (authoritative, most recent): Square
  and other POS integrations are explicitly out of MVP scope, deferred to
  Phase 2. CSV import is the source of truth for the MVP.
- **Market research** (`personas-and-research.md`, Part 3, hypotheses H2b
  and H7): Square and Toast are rated "must-have / critical" for
  competitive positioning, based on 7 of 8 competitors emphasizing them in
  marketing. QuickBooks is "table stakes."
- **`VISION.md`**: originally listed Square as MVP scope, before being
  superseded by the CSV-first decision.

**Not resolved.** The MVP is deliberately shipping without POS
integration despite market research suggesting it's competitively
important. Whether this is validated by real customer conversations
(rather than competitor marketing pages) is itself unvalidated — see the
"human validation queue" in `personas-and-research.md`.

### Pricing anchor mismatch

- **Current/live pricing** (`cost-and-pricing.md`, and confirmed live on
  pantry-iq.com and the master-branch README): $20/location/month,
  $10/truck/month.
- **Market research** (`cost-and-pricing.md` → market pricing section):
  competitor pricing bands cluster at $79–199 (entry), $249–350 (core
  "sweet spot"), $400–500+ (premium). The research's wedge recommendation
  was to enter at $249–350/mo.

**Not resolved.** No document explains whether $20/$10 is a deliberate
early-adopter/beta rate, a permanent low-cost-structure wedge strategy,
or simply hasn't been revisited since the market research was done. See
`cost-and-pricing.md` for the full breakdown and three unconfirmed
hypotheses about what might explain the gap.

## 3. Technical / product-detail unknowns

These are narrower than the scope tensions above — they're implementation
details that were explicitly left "TBD" or "CPO input needed" in the
source docs and were never subsequently answered.

- **Data sufficiency threshold** — `expected-ux-v2.md` proposed 7 days of
  transaction data as the minimum before showing dashboard insights, but
  flagged this as unconfirmed and possibly needing adjustment.
- **Dashboard widget content** — exact widgets/layout beyond the "wallet
  impact summary + top recommendations + item deep dives" themes are
  explicitly deferred to beta user feedback in both `expected-ux-v2.md`
  and `expected-ux-v3.md`.
- **Shelf life defaults by category** — needs a sensible default table
  (e.g. "seafood" → 3 days) and a decision on source: AI lookup, a lookup
  table, or hardcoded values.
- **Spoilage calculation priority** — when both PO+transaction math and
  inventory snapshots are available and disagree, which is authoritative?
- **Alert minimum thresholds** — see Q4 above; also framed in
  `RECOMMENDATION-ENGINE-ARCHITECTURE.md` as "show top 5 regardless" vs.
  "only show if Impact > $X AND Urgency > Y."
- **Urgency weight multipliers / exact scoring formulas** — the 40/40/20
  weighting is settled, but the underlying per-dimension calculations
  (how exactly Impact, Urgency, and Data Sufficiency are computed from
  raw data) are not.

## 4. Validation queue (pointer)

Separate from open *decisions* above, there's a list of things that need
real operator input before they can be decided at all — CSV-only
onboarding acceptance, purchase/inventory data quality patterns, whether
daily dashboard recommendations get used without external notifications,
and Square/pricing willingness-to-pay. This lives in the "Validation
queue" section of `mvp-scope-and-decisions.md` rather than being
duplicated here, since those are next-step actions, not open design
questions.

The market-research side has its own, larger validation queue (food
truck segment behavior, community/review mining, churn signals,
integration willingness-to-pay, real-time forecasting demand, waste
quantification value) — see `personas-and-research.md`, Part 3, "Human
validation queue."

## 5. Customer-discovery vs. market-research hypothesis numbering

Not a product question, but a documentation hazard worth flagging
explicitly: `personas-and-research.md` contains **two unrelated H1–H10
hypothesis sets** (Customer Discovery Hypotheses in Part 2, Market
Research Hypotheses in Part 3). They share numbering by coincidence, not
by relationship. Any future document that cites "H4" or similar without
specifying which set risks silently conflating two different claims.
